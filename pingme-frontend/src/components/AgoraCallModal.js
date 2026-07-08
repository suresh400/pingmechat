import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Stack, Typography, IconButton, Avatar, CircularProgress, Fab, Badge } from "@mui/material";
import {
    PhoneDisconnect, Microphone, MicrophoneSlash,
    VideoCamera, VideoCameraSlash, ArrowCounterClockwise, PhoneCall,
    SpeakerHigh, SpeakerSlash
} from "phosphor-react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE } from "../constants";

// Requirement 2: Deterministic Channel Strategy
const getChannel = (id1, id2) => {
    const sorted = [Number(id1), Number(id2)].sort((a, b) => a - b);
    return `call_${sorted[0]}_${sorted[1]}`;
};

const AgoraCallModal = ({ callState, onAccept, onDecline, socket }) => {
    const { open, type, contact, isIncoming, callLogId, isGroup } = callState || {};
    const { currentUser, authFetch } = useAuth();

    const clientRef = useRef(null);
    const localAudioRef = useRef(null);
    const localVideoRef = useRef(null);
    const joinedRef = useRef(false);

    const socketRef = useRef(socket);
    const callLogIdRef = useRef(callLogId);
    const onDeclineRef = useRef(onDecline);
    const onAcceptRef = useRef(onAccept);

    useEffect(() => { socketRef.current = socket; }, [socket]);
    useEffect(() => { callLogIdRef.current = callLogId; }, [callLogId]);
    useEffect(() => { onDeclineRef.current = onDecline; }, [onDecline]);
    useEffect(() => { onAcceptRef.current = onAccept; }, [onAccept]);

    const [joined, setJoined] = useState(false);
    const [joining, setJoining] = useState(false);
    const [remoteUsers, setRemoteUsers] = useState([]);
    const [micMuted, setMicMuted] = useState(false);
    const [camOff, setCamOff] = useState(false);
    const [speakerOn, setSpeakerOn] = useState(true);
    const [callSeconds, setCallSeconds] = useState(0);
    const [status, setStatus] = useState(""); // Connecting, Ringing, In call
    const [userProfiles, setUserProfiles] = useState({});
    const [groupMembers, setGroupMembers] = useState([]);

    useEffect(() => {
        if (open && isGroup && contact?.id) {
            authFetch(`${API_BASE}/groups/${contact.id}/members`)
                .then((res) => {
                    if (res && res.ok) return res.json();
                })
                .then((data) => {
                    if (data) setGroupMembers(data);
                })
                .catch((err) => console.error("Failed to fetch group members in modal", err));
        } else if (!open) {
            setGroupMembers([]);
        }
    }, [open, isGroup, contact?.id, authFetch]);

    useEffect(() => {
        if (!socket) return;
        const handleStatusUpdate = (data) => {
            setGroupMembers((prev) =>
                prev.map((m) =>
                    Number(m.id) === Number(data.userId)
                        ? { ...m, is_online: data.is_online }
                        : m
                )
            );
        };
        socket.on("user_status_update", handleStatusUpdate);
        return () => {
            socket.off("user_status_update", handleStatusUpdate);
        };
    }, [socket]);

    const fetchUserProfile = useCallback(async (uid) => {
        if (!uid) return;
        try {
            const res = await authFetch(`${API_BASE}/users/batch?ids=${uid}`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                setUserProfiles(prev => ({ ...prev, [uid]: data[0] }));
            }
        } catch (err) {
            console.error("Failed to fetch profile for uid:", uid, err);
        }
    }, [authFetch]);

    const timerRef = useRef(null);
    const callStartTimeRef = useRef(null);

    const startTimer = () => {
        if (timerRef.current) return;
        callStartTimeRef.current = Date.now();
        timerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    };

    const fetchToken = useCallback(async (channel, uid) => {
        try {
            console.log(`[Agora] Fetching token for channel: ${channel}, uid: ${uid}`);
            const res = await authFetch(`${API_BASE}/call/token`, {
                method: "POST",
                body: JSON.stringify({ channel, uid: Number(uid) }),
            });
            const data = await res.json();
            console.log(`[Agora] Token status: ${res.status}`, data.appId ? "AppID OK" : "AppID FAIL");
            return { token: data.token, appId: data.appId };
        } catch (err) {
            console.error("Token fetch failed:", err);
            return { token: null, appId: null };
        }
    }, [authFetch]);

    const leaveChannel = useCallback(async () => {
        console.log("[Agora] Leaving channel...");
        clearInterval(timerRef.current);
        timerRef.current = null;
        setStatus("");

        if (localAudioRef.current) {
            localAudioRef.current.close();
            localAudioRef.current = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.close();
            localVideoRef.current = null;
        }

        if (clientRef.current) {
            try { await clientRef.current.leave(); } catch (e) { console.warn("Cleanup error:", e); }
            clientRef.current = null;
        }

        setJoined(false);
        joinedRef.current = false;
        setJoining(false);
        setRemoteUsers([]);
        setCallSeconds(0);
    }, []);

    const joinChannel = useCallback(async () => {
        if (!currentUser || !contact || joinedRef.current) return;
        joinedRef.current = true;
        setJoining(true);
        setStatus("Connecting...");

        try {
            const channel = isGroup ? `group_${contact.id}` : getChannel(currentUser.id, contact.id);
            const uid = currentUser.id;
            const { token, appId } = await fetchToken(channel, uid);

            if (!appId) throw new Error("Missing Agora App ID");

            const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
            clientRef.current = client;

            // Requirement 4: Comprehensive Agora Event Handling
            client.on("user-joined", (user) => {
                console.log(`[Agora] User joined: ${user.uid}`);
                setRemoteUsers((prev) => {
                    if (prev.some((u) => u.uid === user.uid)) return prev;
                    return [...prev, user];
                });
                fetchUserProfile(user.uid);
                setStatus("Connected");
                startTimer();
            });

            client.on("user-published", async (user, mediaType) => {
                await client.subscribe(user, mediaType);
                console.log(`[Agora] User published: ${user.uid} (${mediaType})`);
                if (mediaType === "audio") {
                    user.audioTrack?.play();
                }
                setRemoteUsers((prev) => {
                    if (prev.some((u) => u.uid === user.uid)) {
                        return prev.map((u) => u.uid === user.uid ? user : u);
                    }
                    return [...prev, user];
                });
                fetchUserProfile(user.uid);
                setStatus("Connected");
                startTimer();
            });

            client.on("user-unpublished", (user, mediaType) => {
                console.log(`[Agora] User unpublished: ${user.uid} (${mediaType})`);
                setRemoteUsers((prev) => prev.map((u) => u.uid === user.uid ? user : u));
            });

            client.on("user-left", (user) => {
                console.log(`[Agora] User left: ${user.uid}`);
                setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
                
                const remainingCount = (client.remoteUsers || []).filter((u) => u.uid !== user.uid).length;
                
                if (!isGroup || remainingCount === 0) {
                    console.log(`[Agora] Ending call. Group: ${isGroup}, Remaining remote users: ${remainingCount}`);
                    const duration = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
                    if (!isGroup) {
                        socketRef.current?.emit("end_call", { callLogId: callLogIdRef.current, duration_seconds: duration });
                    } else if (callLogIdRef.current) {
                        socketRef.current?.emit("leave_group_call", { group_id: contact?.id, callLogId: callLogIdRef.current });
                        authFetch(`${API_BASE}/calls/log/${callLogIdRef.current}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "accepted", duration_seconds: duration })
                        }).catch((err) => console.error("Error updating group call log", err));
                    }
                    
                    leaveChannel();
                    onDeclineRef.current?.();
                }
            });

            client.on("connection-state-change", (curState, revState, reason) => {
                console.log(`[Agora] Connection state: ${revState} -> ${curState} (${reason})`);
            });

            console.log(`[Agora] Joining channel: ${channel} as uid: ${uid}`);
            await client.join(appId, channel, token, Number(uid));
            console.log("[Agora] Join successful!");

            const existingRemoteUsers = client.remoteUsers || [];
            if (existingRemoteUsers.length > 0) {
                setRemoteUsers([...existingRemoteUsers]);
                existingRemoteUsers.forEach((u) => {
                    fetchUserProfile(u.uid);
                });
                setStatus("Connected");
                startTimer();
            } else {
                setStatus("Calling...");
            }

            const tracks = [];
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            localAudioRef.current = audioTrack;
            tracks.push(audioTrack);

            if (type === "video") {
                try {
                    const videoTrack = await AgoraRTC.createCameraVideoTrack();
                    localVideoRef.current = videoTrack;
                    tracks.push(videoTrack);
                } catch (vErr) {
                    console.error("Camera denied:", vErr.message);
                }
            }

            await client.publish(tracks);
            setJoined(true);
            setJoining(false);
            setStatus(isIncoming || isGroup ? "Connected" : "Ringing...");
            console.log("[Agora] Local tracks published successfully.");
            if (isIncoming || isGroup) {
                startTimer();
            }
            console.log("[Agora] Local tracks published to channel:", channel);
        } catch (err) {
            console.error("Call Join Error:", err);
            setJoining(false);
            joinedRef.current = false;
            setStatus("Connection Error");
        }
    }, [currentUser, contact, type, fetchToken, isIncoming, leaveChannel, isGroup, fetchUserProfile, authFetch]);

    const handleAccept = () => {
        joinChannel();
        if (!isGroup) {
            socket?.emit("accept_call", { to: contact.id, callLogId });
        } else if (callLogId) {
            authFetch(`${API_BASE}/calls/log/${callLogId}/join`, { method: "POST" })
                .catch((err) => console.error("Error joining group call log", err));
        }
        onAccept?.();
    };

    const handleDecline = async () => {
        if (joinedRef.current || joined) {
            const duration = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
            if (isGroup) {
                if (callLogId) {
                    socket?.emit("leave_group_call", { group_id: contact?.id, callLogId });
                    authFetch(`${API_BASE}/calls/log/${callLogId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "accepted", duration_seconds: duration })
                    }).catch((err) => console.error("Error updating group call log", err));
                }
                if (!isIncoming && remoteUsers.length === 0) {
                    socket?.emit("cancel_group_call", { group_id: contact?.id, sender_id: currentUser.id });
                }
            } else {
                socket?.emit("end_call", { callLogId, duration_seconds: duration });
            }
        } else {
            if (isGroup) {
                if (!isIncoming) {
                    socket?.emit("cancel_group_call", { group_id: contact?.id, sender_id: currentUser.id });
                }
            } else {
                if (isIncoming) socket?.emit("decline_call", { to: contact?.id, callLogId });
                else socket?.emit("cancel_call", { to: contact?.id, callLogId });
            }
        }
        await leaveChannel();
        onDecline?.();
    };

    useEffect(() => {
        if (open && !isIncoming) joinChannel();
        if (!open) leaveChannel();
        return () => {
            leaveChannel();
        };
    }, [open, isIncoming, joinChannel, leaveChannel]);

    useEffect(() => {
        if (isGroup && callLogId && joined && contact?.id) {
            console.log(`[Agora] Emitting join_group_call for ${callLogId}`);
            socket?.emit("join_group_call", { group_id: contact.id, callLogId });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGroup, callLogId, joined, socket, contact?.id]);

    useEffect(() => {
        // Play remote video when remoteUsers change
        remoteUsers.forEach((user) => {
            const el = document.getElementById(`remote-video-${user.uid}`);
            if (el && user.videoTrack) {
                user.videoTrack.play(el);
            }
        });
    }, [remoteUsers]);

    useEffect(() => {
        // Play local video
        if (joined && localVideoRef.current && document.getElementById("local-video")) {
            localVideoRef.current.play("local-video");
        }
    }, [joined, localVideoRef]);

    if (!open) return null;

    const mm = String(Math.floor(callSeconds / 60)).padStart(2, "0");
    const ss = String(callSeconds % 60).padStart(2, "0");
    const timerStr = `${mm}:${ss}`;

    const isVideo = type === "video";

    return (
        <Box sx={{
            position: "fixed", inset: 0, zIndex: 9999,
            bgcolor: "#000", display: "flex", flexDirection: "column",
            overflow: "hidden"
        }}>
            {/* Immersive Background */}
            <Box sx={{
                position: "absolute", inset: 0, zIndex: 0,
                background: "linear-gradient(to bottom, #1a1a1a, #000)",
                animation: !joined ? "breathingBg 8s ease-in-out infinite" : "none",
                "@keyframes breathingBg": {
                    "0%, 100%": { opacity: 0.8 },
                    "50%": { opacity: 1 },
                }
            }} />

            {/* Remote Video(s) Grid / Avatar */}
            {isVideo && remoteUsers.length > 0 ? (
                <Box sx={{
                    position: "absolute", inset: 0, zIndex: 1,
                    display: "grid",
                    gridTemplateColumns: remoteUsers.length === 1 ? "1fr" : (remoteUsers.length === 2 ? "1fr" : "1fr 1fr"),
                    gridTemplateRows: remoteUsers.length <= 2 ? "1fr 1fr" : "1fr 1fr",
                    gap: 1.5,
                    p: 2,
                    pt: 18,
                    pb: 18,
                    bgcolor: "#111"
                }}>
                    {remoteUsers.map((user) => (
                        <Box
                            key={user.uid}
                            sx={{
                                width: "100%", height: "100%",
                                position: "relative",
                                borderRadius: 3, overflow: "hidden",
                                border: "2px solid rgba(255,255,255,0.1)",
                                bgcolor: "#222"
                            }}
                        >
                            <Box
                                id={`remote-video-${user.uid}`}
                                sx={{
                                    width: "100%", height: "100%",
                                    "& video": { objectFit: "cover !important" }
                                }}
                            />
                            <Box sx={{
                                position: "absolute", bottom: 8, left: 8,
                                bgcolor: "rgba(0,0,0,0.6)", px: 1, py: 0.5,
                                borderRadius: 1, color: "#fff", pointerEvents: "none", zIndex: 5
                            }}>
                                <Typography variant="caption" fontWeight={600}>
                                    {userProfiles[user.uid]?.username || `User ${user.uid}`}
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                </Box>
            ) : (
                <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, zIndex: 1, width: "100%" }}>
                    <Avatar
                        src={contact?.avatar}
                        sx={{
                            width: 140, height: 140,
                            border: "4px solid rgba(255,255,255,0.2)",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.8)",
                            transition: "all 0.5s ease"
                        }}
                    />
                    {isGroup && !isVideo && groupMembers.length > 0 ? (
                        <Stack spacing={2} alignItems="center" sx={{ mt: 4, width: "100%", maxWidth: "500px", px: 4 }}>
                            <Typography variant="subtitle2" sx={{ color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1.5, fontSize: "0.75rem", fontWeight: 700 }}>
                                Group Members
                            </Typography>
                            <Box sx={{
                                display: "flex", flexWrap: "wrap", gap: 3,
                                justifyContent: "center", width: "100%", maxHeight: "240px",
                                overflowY: "auto", py: 1, px: 2
                            }}>
                                {groupMembers.map((member) => {
                                    if (member.id === currentUser.id) return null; // Skip self
                                    const isJoined = remoteUsers.some((ru) => Number(ru.uid) === Number(member.id));
                                    const statusText = isJoined ? "Connected" : (member.is_online ? "Ringing..." : "Offline");
                                    const isActive = isJoined;
                                    
                                    return (
                                        <Stack key={member.id} alignItems="center" spacing={1} sx={{ width: 80 }}>
                                            <Badge
                                                overlap="circular"
                                                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                                badgeContent={
                                                    <Box sx={{
                                                        width: 12, height: 12, borderRadius: "50%",
                                                        bgcolor: isActive ? "#4CAF50" : (member.is_online ? "#FFC107" : "#9E9E9E"),
                                                        border: "2px solid #000",
                                                        animation: member.is_online && !isActive ? "pulse 1.5s infinite" : "none",
                                                        "@keyframes pulse": {
                                                            "0%": { transform: "scale(0.8)", opacity: 0.5 },
                                                            "50%": { transform: "scale(1.2)", opacity: 1 },
                                                            "100%": { transform: "scale(0.8)", opacity: 0.5 }
                                                        }
                                                    }} />
                                                }
                                            >
                                                <Avatar
                                                    src={member.avatar}
                                                    sx={{
                                                        width: 60, height: 60,
                                                        border: isActive ? "3px solid #4CAF50" : "2px solid rgba(255,255,255,0.1)",
                                                        filter: isActive ? "none" : "grayscale(30%)",
                                                        opacity: isActive ? 1 : 0.6
                                                    }}
                                                />
                                            </Badge>
                                            <Typography variant="body2" sx={{
                                                color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                                                fontWeight: isActive ? 600 : 400,
                                                textAlign: "center", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", width: "100%"
                                            }}>
                                                {member.username}
                                            </Typography>
                                            <Typography variant="caption" sx={{
                                                color: isActive ? "#4CAF50" : (member.is_online ? "#FFC107" : "rgba(255,255,255,0.4)"),
                                                fontSize: "0.7rem"
                                            }}>
                                                {statusText}
                                            </Typography>
                                        </Stack>
                                    );
                                })}
                            </Box>
                        </Stack>
                    ) : (
                        !isVideo && remoteUsers.length > 0 && (
                            <Stack direction="row" spacing={2} sx={{ mt: 4, flexWrap: "wrap", justifyContent: "center", px: 4 }}>
                                {remoteUsers.map((user) => {
                                    const profile = userProfiles[user.uid];
                                    return (
                                        <Stack key={user.uid} alignItems="center" spacing={0.5}>
                                            <Avatar src={profile?.avatar} sx={{ width: 60, height: 60, border: "2px solid #fff" }} />
                                            <Typography variant="caption" sx={{ color: "#fff", opacity: 0.8 }}>
                                                {profile?.username || `User ${user.uid}`}
                                            </Typography>
                                        </Stack>
                                    );
                                })}
                            </Stack>
                        )
                    )}
                </Stack>
            )}

            {/* Video Call Sidebar for Group Members Not In Call */}
            {isVideo && isGroup && groupMembers.length > 0 && (
                <Box sx={{
                    position: "absolute", top: 180, left: 20, zIndex: 10,
                    display: "flex", flexDirection: "column", gap: 1.5,
                    bgcolor: "rgba(0,0,0,0.65)", p: 2, borderRadius: 2,
                    backdropFilter: "blur(15px)", border: "1px solid rgba(255,255,255,0.1)",
                    maxHeight: "300px", overflowY: "auto", width: 180
                }}>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                        Not in call
                    </Typography>
                    {groupMembers.map((member) => {
                        if (member.id === currentUser.id) return null;
                        const isJoined = remoteUsers.some((ru) => Number(ru.uid) === Number(member.id));
                        if (isJoined) return null;
                        
                        return (
                            <Stack key={member.id} direction="row" alignItems="center" spacing={1.5}>
                                <Badge
                                    overlap="circular"
                                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                    badgeContent={
                                        <Box sx={{
                                            width: 8, height: 8, borderRadius: "50%",
                                            bgcolor: member.is_online ? "#FFC107" : "#9E9E9E",
                                            border: "1px solid #000"
                                        }} />
                                    }
                                >
                                    <Avatar src={member.avatar} sx={{ width: 28, height: 28, opacity: 0.7 }} />
                                </Badge>
                                <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                                    <Typography variant="caption" sx={{ color: "#fff", fontWeight: 500, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                        {member.username}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: member.is_online ? "#FFC107" : "rgba(255,255,255,0.4)", fontSize: "0.65rem" }}>
                                        {member.is_online ? "Ringing" : "Offline"}
                                    </Typography>
                                </Stack>
                            </Stack>
                        );
                    })}
                </Box>
            )}

            {/* Overlay Gradient for Visibility */}
            <Box sx={{
                position: "absolute", inset: 0, zIndex: 2,
                background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.8) 100%)",
                pointerEvents: "none"
            }} />

            {/* Header Info */}
            <Stack spacing={0.5} alignItems="center" sx={{ pt: 10, zIndex: 3, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
                    {contact?.name || contact?.username}
                </Typography>
                <Typography variant="body1" sx={{ color: "#fff", opacity: 0.8, fontWeight: 500, letterSpacing: 1 }}>
                    {status === "Connected" ? timerStr : (status || (joining ? "Connecting..." : (joined ? timerStr : (isIncoming ? "Incoming Call..." : "Calling..."))))}
                </Typography>
            </Stack>

            {/* Local Video (PiP) */}
            {joined && isVideo && !camOff && (
                <Box
                    id="local-video"
                    sx={{
                        position: "absolute", top: 40, right: 20, zIndex: 10,
                        width: 110, height: 160, borderRadius: 3,
                        border: "2px solid rgba(255,255,255,0.3)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                        overflow: "hidden", bgcolor: "#111",
                        "& video": { objectFit: "cover !important" }
                    }}
                />
            )}

            {/* Bottom Controls */}
            <Stack
                direction="row"
                justifyContent="center"
                alignItems="center"
                spacing={4}
                sx={{
                    position: "absolute", bottom: 60, width: "100%", zIndex: 10,
                    px: 4
                }}
            >
                {/* Accept Button (Only for incoming) */}
                {isIncoming && !joined && (
                    <Fab
                        onClick={handleAccept}
                        disabled={joining}
                        sx={{
                            width: 72, height: 72, bgcolor: "#4CAF50", color: "#fff",
                            "&:hover": { bgcolor: "#388E3C" },
                            boxShadow: "0 0 30px rgba(76,175,80,0.4)",
                            animation: "pulseGreen 2s infinite",
                            "@keyframes pulseGreen": {
                                "0%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(76,175,80,0.7)" },
                                "70%": { transform: "scale(1.1)", boxShadow: "0 0 0 20px rgba(76,175,80,0)" },
                                "100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(76,175,80,0)" },
                            }
                        }}
                    >
                        {joining ? <CircularProgress size={32} color="inherit" /> : <PhoneCall size={36} weight="fill" />}
                    </Fab>
                )}

                {/* Joined Controls Overlay */}
                {joined && (
                    <Box sx={{
                        display: "flex", gap: { xs: 2, sm: 3 }, p: 2,
                        bgcolor: "rgba(255,255,255,0.15)", borderRadius: 10,
                        backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)"
                    }}>
                        <IconButton
                            onClick={() => { localAudioRef.current?.setMuted(!micMuted); setMicMuted(!micMuted); }}
                            sx={{ color: micMuted ? "#FF3B30" : "#fff", bgcolor: micMuted ? "rgba(255,255,255,0.2)" : "transparent" }}
                        >
                            {micMuted ? <MicrophoneSlash size={28} weight="bold" /> : <Microphone size={28} weight="bold" />}
                        </IconButton>

                        {isVideo && (
                            <IconButton
                                onClick={() => { localVideoRef.current?.setMuted(!camOff); setCamOff(!camOff); }}
                                sx={{ color: camOff ? "#FF3B30" : "#fff", bgcolor: camOff ? "rgba(255,255,255,0.2)" : "transparent" }}
                            >
                                {camOff ? <VideoCameraSlash size={28} weight="bold" /> : <VideoCamera size={28} weight="bold" />}
                            </IconButton>
                        )}

                        <IconButton
                            onClick={() => setSpeakerOn(!speakerOn)}
                            sx={{ color: "#fff", bgcolor: !speakerOn ? "rgba(255,255,255,0.2)" : "transparent" }}
                        >
                            {speakerOn ? <SpeakerHigh size={28} weight="bold" /> : <SpeakerSlash size={28} weight="bold" />}
                        </IconButton>

                        {isVideo && (
                            <IconButton sx={{ color: "#fff" }}>
                                <ArrowCounterClockwise size={28} weight="bold" />
                            </IconButton>
                        )}
                    </Box>
                )}

                {/* Decline / Hangup Button */}
                <Fab
                    onClick={handleDecline}
                    sx={{
                        width: 72, height: 72,
                        bgcolor: "#FF3B30", color: "#fff",
                        "&:hover": { bgcolor: "#D12B26" },
                        boxShadow: "0 0 30px rgba(255,59,48,0.3)",
                    }}
                >
                    <PhoneDisconnect size={36} weight="fill" />
                </Fab>
            </Stack>

            {/* Brand Logo */}
            <Box sx={{ position: "absolute", bottom: 20, width: "100%", textAlign: "center", opacity: 0.3, zIndex: 3 }}>
                <Typography variant="caption" sx={{ letterSpacing: 2, fontWeight: 700, color: "#fff" }}>
                    PINGME END-TO-END ENCRYPTED
                </Typography>
            </Box>
        </Box>
    );
};

export default AgoraCallModal;