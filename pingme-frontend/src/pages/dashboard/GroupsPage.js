import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Box, Stack, Typography, Avatar, InputBase, IconButton, Button, Drawer,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Chip, CircularProgress, Divider, Snackbar, Alert, Tooltip, useMediaQuery, useTheme, Menu, MenuItem
} from "@mui/material";
import { MagnifyingGlass, Plus, PaperPlaneRight, Smiley, Users, X, Paperclip, Gear, VideoCamera, CaretLeft, Info, Phone, Hourglass, Palette, ListChecks } from "phosphor-react";
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import useSettings from "../../hooks/useSettings";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { useNavigate, useOutletContext } from "react-router-dom";
import SelfDestructCountdown from "../../components/SelfDestructCountdown";
import WhiteboardDialog from "../../components/WhiteboardDialog";
import ConvertToTaskDialog from "../../components/ConvertToTaskDialog";

import { API_BASE, BASE_URL } from "../../constants";

const GroupsPage = () => {
    const { currentUser, authFetch } = useAuth();
    const socket = useSocket();

    const { themeMode, customChatBgColor } = useSettings();
    const isDark = themeMode === "dark";

    const getFileUrl = (path) => {
        if (!path) return "";
        if (path.startsWith("http")) return path;
        return `${BASE_URL}${path}`;
    };

    const [groups, setGroups] = useState([]);
    const [activeGroup, setActiveGroup] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStream, setRecordingStream] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [timerMenuAnchor, setTimerMenuAnchor] = useState(null);
    const [selfDestructSeconds, setSelfDestructSeconds] = useState(0);
    const [whiteboardOpen, setWhiteboardOpen] = useState(false);
    const [taskDialogOpen, setTaskDialogOpen] = useState(false);
    const [taskMessageText, setTaskMessageText] = useState("");

    // ── Group unread badges: { [groupId]: count } ─────────────────────────────
    const [groupUnread, setGroupUnread] = useState({});
    const activeGroupRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const videoChunksRef = useRef([]);
    const timerRef = useRef(null);

    // Create group dialog
    const [createOpen, setCreateOpen] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [memberSearch, setMemberSearch] = useState("");
    const [memberResults, setMemberResults] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

    // Group members list
    const [groupMembers, setGroupMembers] = useState([]);

    // Add member dialog
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [addSearch, setAddSearch] = useState("");
    const [addResults, setAddResults] = useState([]);

    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const { setCallState } = useOutletContext();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const [showGroupInfo, setShowGroupInfo] = useState(false);

    const startGroupCall = (type) => {
        if (!activeGroup || !setCallState || !socket) return;
        setCallState({
            open: true,
            type,
            contact: activeGroup,
            isIncoming: false,
            isGroup: true,
        });
        socket.emit("start_group_call", {
            group_id: activeGroup.id,
            type,
            callerName: currentUser?.username,
            callerAvatar: currentUser?.avatar,
            sender_id: currentUser?.id,
        });
    };

    const fetchGroups = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/groups`);
            const data = await res.json();
            setGroups(Array.isArray(data) ? data : []);
        } finally { setLoading(false); }
    }, [authFetch]);

    useEffect(() => { fetchGroups(); }, [fetchGroups]);

    // Keep activeGroupRef in sync so socket handler always has latest value
    useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);

    // Join group rooms and listen for messages
    useEffect(() => {
        if (!socket || groups.length === 0) return;
        groups.forEach((g) => socket.emit("join_group", g.id));
        const handler = (msg) => {
            const currentActive = activeGroupRef.current;
            if (currentActive && msg.group_id === currentActive.id) {
                // In the active group — append message directly
                setMessages((prev) => {
                    if (prev.find((m) => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            } else {
                // Not in this group — increment its unread badge
                setGroupUnread((prev) => ({
                    ...prev,
                    [msg.group_id]: (prev[msg.group_id] || 0) + 1,
                }));
            }
        };
        socket.on("receive_group_message", handler);
        return () => socket.off("receive_group_message", handler);
    }, [socket, groups]);

    useEffect(() => {
        if (!socket) return;
        const deleteHandler = (data) => {
            const { messageId } = data;
            setMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
        };
        socket.on("message_deleted", deleteHandler);
        return () => socket.off("message_deleted", deleteHandler);
    }, [socket]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const openGroup = async (group) => {
        setActiveGroup(group);
        // Clear unread badge for this group immediately on open
        setGroupUnread((prev) => ({ ...prev, [group.id]: 0 }));
        try {
            const res = await authFetch(`${API_BASE}/groups/${group.id}/messages`);
            const data = await res.json();
            setMessages(Array.isArray(data) ? data : []);

            const membersRes = await authFetch(`${API_BASE}/groups/${group.id}/members`);
            const membersData = await membersRes.json();
            setGroupMembers(Array.isArray(membersData) ? membersData : []);
        } catch { 
            setMessages([]); 
            setGroupMembers([]);
        }
    };

    const handleSend = () => {
        if (!newMessage.trim() || !activeGroup || !socket) return;
        socket.emit("send_group_message", {
            group_id: activeGroup.id,
            sender_id: currentUser.id,
            message: newMessage.trim(),
            sender_name: currentUser.username,
            sender_avatar: currentUser.avatar,
            self_destruct_seconds: selfDestructSeconds,
        });
        setNewMessage("");
        setShowEmojiPicker(false);
        setSelfDestructSeconds(0);
    };

    const uploadAndSend = async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await authFetch(`${API_BASE}/upload`, { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            socket.emit("send_group_message", {
                group_id: activeGroup.id,
                sender_id: currentUser.id,
                message: data.url,
                sender_name: currentUser.username,
                sender_avatar: currentUser.avatar,
                self_destruct_seconds: selfDestructSeconds,
            });
            setSelfDestructSeconds(0);
        } catch (err) {
            setSnackbar({ open: true, message: err.message, severity: "error" });
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeGroup) return;
        await uploadAndSend(file);
        e.target.value = null;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setRecordingStream(stream);
            mediaRecorderRef.current = new MediaRecorder(stream);
            videoChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) videoChunksRef.current.push(e.data);
            };
            mediaRecorderRef.current.onstop = () => {
                const videoBlob = new Blob(videoChunksRef.current, { type: "video/webm" });
                const videoUrl = URL.createObjectURL(videoBlob);
                setVideoPreview({ blob: videoBlob, url: videoUrl });
                stream.getTracks().forEach(track => track.stop());
                setRecordingStream(null);
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            setSnackbar({ open: true, message: "Camera access denied", severity: "error" });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
            // tracks are stopped in onstop
        }
    };

    const discardRecording = () => {
        if (isRecording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }
            if (recordingStream) {
                recordingStream.getTracks().forEach(track => track.stop());
                setRecordingStream(null);
            }
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
        setVideoPreview(null);
    };

    const sendVideoRecording = async () => {
        if (!videoPreview || !activeGroup) return;
        const file = new File([videoPreview.blob], `video-${Date.now()}.webm`, { type: "video/webm" });
        await uploadAndSend(file);
        setVideoPreview(null);
    };

    const onEmojiClick = (emojiData) => {
        setNewMessage((prev) => prev + emojiData.emoji);
    };

    // Member search for group creation
    useEffect(() => {
        if (!memberSearch.trim()) { setMemberResults([]); return; }
        const timer = setTimeout(async () => {
            const res = await authFetch(`${API_BASE}/contacts/search?username=${encodeURIComponent(memberSearch)}`);
            const data = await res.json();
            setMemberResults(Array.isArray(data) ? data : []);
        }, 300);
        return () => clearTimeout(timer);
    }, [memberSearch, authFetch]);

    const handleCreateGroup = async () => {
        if (!groupName.trim()) return;
        try {
            const res = await authFetch(`${API_BASE}/groups`, {
                method: "POST",
                body: JSON.stringify({ name: groupName, memberUsernames: selectedMembers.map((m) => m.username) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setSnackbar({ open: true, message: `Group "${groupName}" created!`, severity: "success" });
            setCreateOpen(false);
            setGroupName(""); setSelectedMembers([]); setMemberSearch("");
            fetchGroups();
        } catch (err) {
            setSnackbar({ open: true, message: err.message, severity: "error" });
        }
    };

    // Member search for adding member to group
    useEffect(() => {
        if (!addSearch.trim()) { setAddResults([]); return; }
        const timer = setTimeout(async () => {
            const res = await authFetch(`${API_BASE}/contacts/search?username=${encodeURIComponent(addSearch)}`);
            const data = await res.json();
            setAddResults(Array.isArray(data) ? data : []);
        }, 300);
        return () => clearTimeout(timer);
    }, [addSearch, authFetch]);

    const handleAddMember = async (username) => {
        if (!activeGroup) return;
        try {
            const res = await authFetch(`${API_BASE}/groups/${activeGroup.id}/members`, {
                method: "POST",
                body: JSON.stringify({ username }),
            });
            const data = await res.json();
            if (res.ok) {
                setSnackbar({ open: true, message: "Member added successfully!", severity: "success" });
                setGroupMembers((prev) => [...prev, data.user]);
                setAddMemberOpen(false);
                setAddSearch("");
                setAddResults([]);
            } else {
                setSnackbar({ open: true, message: data.message || "Failed to add member", severity: "error" });
            }
        } catch (err) {
            setSnackbar({ open: true, message: "Server error", severity: "error" });
        }
    };

    const renderGroupInfoContent = () => (
        <React.Fragment>
            <Box p={2} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="subtitle1" fontWeight={700}>Group Details</Typography>
                <IconButton onClick={() => setShowGroupInfo(false)} size="small"><X size={20} /></IconButton>
            </Box>
            <Divider />
            <Box p={3} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <Avatar src={activeGroup?.avatar} sx={{ width: 100, height: 100, bgcolor: "text.primary" }}><Users size={40} color="#fff" /></Avatar>
                <Box textAlign="center">
                    <Typography variant="h6" fontWeight={700}>{activeGroup?.name}</Typography>
                    <Typography variant="body2" color="text.secondary">Participants: {groupMembers.length} Members</Typography>
                </Box>
            </Box>
            <Divider />
            <Box p={2}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700, mb: 1, display: "block" }}>Description</Typography>
                <Typography variant="body2">Welcome to {activeGroup?.name}!</Typography>
            </Box>
            <Divider />
            <Box p={2} sx={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>Members</Typography>
                    <Button
                        variant="text"
                        size="small"
                        onClick={() => setAddMemberOpen(true)}
                        sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}
                    >
                        + Add Member
                    </Button>
                </Stack>
                <Stack spacing={1.5}>
                    {groupMembers.map((m) => (
                        <Stack key={m.id} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box sx={{ position: "relative" }}>
                                    <Avatar src={m.avatar} sx={{ width: 36, height: 36 }} />
                                    {m.is_online === 1 && (
                                        <Box sx={{
                                            position: "absolute", bottom: 0, right: 0,
                                            width: 10, height: 10, borderRadius: "50%",
                                            bgcolor: "#4CAF50", border: "2px solid",
                                            borderColor: "background.paper"
                                        }} />
                                    )}
                                </Box>
                                <Typography variant="body2" fontWeight={600}>{m.username}</Typography>
                            </Stack>
                            <Typography variant="caption" color={m.is_online === 1 ? "success.main" : "text.secondary"}>
                                {m.is_online === 1 ? "Online" : "Offline"}
                            </Typography>
                        </Stack>
                    ))}
                </Stack>
            </Box>
        </React.Fragment>
    );

    const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

    return (
        <Stack direction="row" sx={{ width: "100%", height: "100%" }}>
            {/* ── 1. Groups List Panel ────────────────────────────────────────── */}
            {(!isMobile || !activeGroup) && (
                <Box sx={{
                    width: isMobile ? "100%" : 320,
                    bgcolor: "background.paper",
                    height: "100%",
                    boxShadow: "2px 0 5px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    flexShrink: 0
                }}>
                    <Box sx={{ p: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="h6" fontWeight={800}>Groups</Typography>
                        <Button
                            startIcon={<Plus size={16} weight="bold" />}
                            size="small"
                            onClick={() => setCreateOpen(true)}
                            sx={{ bgcolor: "text.primary", color: "background.paper", textTransform: "none", borderRadius: 2, fontWeight: 700, px: 2, "&:hover": { bgcolor: "text.primary", opacity: 0.9 } }}
                        >
                            New
                        </Button>
                    </Box>
                    <Box sx={{ flexGrow: 1, overflowY: "auto", p: 1 }}>
                        {loading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress size={24} sx={{ color: "text.primary" }} /></Box>
                        ) : groups.length === 0 ? (
                            <Box sx={{ textAlign: "center", mt: 6, px: 2 }}>
                                <Users size={40} color="#ccc" />
                                <Typography variant="body2" color="text.secondary" mt={1}>No groups yet. Create one!</Typography>
                            </Box>
                        ) : groups.map((g) => (
                            <Box
                                key={g.id}
                                onClick={() => openGroup(g)}
                                sx={{
                                    display: "flex", alignItems: "center", p: 1.5, borderRadius: 2, cursor: "pointer", mb: 0.5,
                                    bgcolor: activeGroup?.id === g.id ? (isDark ? "rgba(255,255,255,0.08)" : "#f0f0f0") : "transparent",
                                    "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5" },
                                }}
                            >
                                <Avatar src={g.avatar} sx={{ width: 44, height: 44, bgcolor: "text.primary" }}>
                                    <Users size={20} color={isDark ? "#000" : "#fff"} />
                                </Avatar>
                                <Box sx={{ ml: 1.5, flexGrow: 1, minWidth: 0 }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Typography variant="subtitle2" fontWeight={700} noWrap>{g.name}</Typography>
                                        {(groupUnread[g.id] || 0) > 0 && (
                                            <Box sx={{
                                                bgcolor: "error.main",
                                                color: "error.contrastText",
                                                borderRadius: "10px",
                                                px: 0.8,
                                                py: 0.2,
                                                fontSize: 10,
                                                fontWeight: 700,
                                                lineHeight: 1.2,
                                                minWidth: 16,
                                                textAlign: "center",
                                                ml: 0.5,
                                            }}>
                                                {groupUnread[g.id]}
                                            </Box>
                                        )}
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">PingMe Group</Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* ── 2. Group Chat Panel ────────────────────────────────────────── */}
            {(!isMobile || activeGroup) && (
                activeGroup ? (
                    <Stack sx={{ flexGrow: 1, height: "100%", width: isMobile ? "100%" : "auto" }}>
                        <Box sx={{ p: 2, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                {isMobile && (
                                    <IconButton onClick={() => setActiveGroup(null)} sx={{ color: "text.primary", mr: -0.5 }}>
                                        <CaretLeft size={24} weight="bold" />
                                    </IconButton>
                                )}
                                <Stack
                                    direction="row"
                                    spacing={1.5}
                                    alignItems="center"
                                    onClick={() => setShowGroupInfo(!showGroupInfo)}
                                    sx={{ cursor: "pointer", "&:hover": { opacity: 0.8 } }}
                                >
                                    <Avatar src={activeGroup.avatar} sx={{ bgcolor: "text.primary" }}><Users size={20} color={isDark ? "#000" : "#fff"} /></Avatar>
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight={700}>{activeGroup.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">Group Messaging</Typography>
                                    </Box>
                                </Stack>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Tooltip title="Group Audio Call">
                                    <IconButton
                                        onClick={() => startGroupCall("audio")}
                                        sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
                                    >
                                        <Phone size={22} weight="bold" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Collaborative Whiteboard">
                                    <IconButton
                                        onClick={() => setWhiteboardOpen(true)}
                                        sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
                                    >
                                        <Palette size={22} weight="bold" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Group Video Call">
                                    <IconButton
                                        onClick={() => startGroupCall("video")}
                                        sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
                                    >
                                        <VideoCamera size={22} weight="bold" />
                                    </IconButton>
                                </Tooltip>
                                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                                <IconButton onClick={() => setShowGroupInfo(!showGroupInfo)} sx={{ color: "text.secondary" }}>
                                    <Info size={22} weight="bold" />
                                </IconButton>
                            </Stack>
                        </Box>

                        <Stack direction="row" sx={{ flexGrow: 1, overflow: "hidden" }}>
                            <Box sx={{
                                flexGrow: 1, height: "100%", overflowY: "auto", p: 3, display: "flex", flexDirection: "column", gap: 1.5,
                                bgcolor: customChatBgColor || (isDark ? "#0b141a" : "#e5ddd5"),
                                backgroundImage: customChatBgColor
                                  ? "none"
                                  : (isDark
                                      ? "linear-gradient(rgba(11, 20, 26, 0.93), rgba(11, 20, 26, 0.93)), url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')"
                                      : "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')"),
                                backgroundRepeat: "repeat",
                            }}>
                                {messages.map((msg) => {
                                    const isOwn = msg.sender_id === currentUser?.id;
                                    return (
                                        <Box key={msg.id} sx={{ display: "flex", alignItems: "flex-end", justifyContent: isOwn ? "flex-end" : "flex-start", gap: 1 }}>
                                            {!isOwn && <Avatar src={msg.sender_avatar} sx={{ width: 28, height: 28 }} />}
                                            <Box>
                                                {!isOwn && <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>{msg.sender_name}</Typography>}
                                                <Box sx={{
                                                    bgcolor: isOwn ? "text.primary" : "background.paper",
                                                    color: isOwn ? "background.paper" : "text.primary",
                                                    p: "10px 14px",
                                                    borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                                    maxWidth: 360,
                                                    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                                                    border: isOwn ? "none" : "1px solid",
                                                    borderColor: "divider"
                                                }}>
                                                    {(() => {
                                                        const messageText = String(msg.message || "").trim();
                                                        const looksLikeLink = messageText.startsWith("http");
                                                        const isUpload = messageText.includes("/uploads") || messageText.includes("\\uploads");
                                                        const isImage = messageText.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i);
                                                        const isVideo = messageText.match(/\.(webm|mp4|ogg)(\?.*)?$/i);

                                                        if (isVideo && (isUpload || looksLikeLink)) {
                                                            return (
                                                                <Box sx={{ position: "relative", borderRadius: 1, overflow: "hidden", mb: 0.5 }}>
                                                                    <video src={getFileUrl(messageText)} controls style={{ width: "100%", borderRadius: "8px", display: "block" }} />
                                                                </Box>
                                                            );
                                                        }

                                                        if (isImage && (isUpload || looksLikeLink)) {
                                                            return (
                                                                <Box
                                                                    component="img"
                                                                    src={getFileUrl(messageText)}
                                                                    alt="attachment"
                                                                    sx={{
                                                                        width: "100%",
                                                                        maxHeight: 300,
                                                                        borderRadius: 1,
                                                                        display: "block",
                                                                        objectFit: "cover",
                                                                        cursor: "pointer"
                                                                    }}
                                                                    onClick={() => window.open(getFileUrl(messageText), "_blank")}
                                                                />
                                                            );
                                                        }

                                                        return (
                                                            <Typography sx={{ fontSize: 14 }}>{msg.message}</Typography>
                                                        );
                                                    })()}
                                                </Box>
                                                <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={isOwn ? "flex-end" : "flex-start"} sx={{ mt: 0.3, px: 0.5 }}>
                                                    <Typography variant="caption" color="text.secondary">{formatTime(msg.created_at)}</Typography>
                                                    {msg.self_destruct_seconds > 0 && (
                                                        <SelfDestructCountdown
                                                            messageId={msg.id}
                                                            seconds={msg.self_destruct_seconds}
                                                            isGroup={true}
                                                            chatId={activeGroup.id}
                                                            authFetch={authFetch}
                                                            onDeleteLocal={(id) => setMessages((prev) => prev.filter((m) => String(m.id) !== String(id)))}
                                                        />
                                                    )}
                                                    <Tooltip title="Convert to Task">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setTaskMessageText(msg.message);
                                                                setTaskDialogOpen(true);
                                                            }}
                                                            sx={{ p: 0, color: "text.disabled", "&:hover": { color: "primary.main" } }}
                                                        >
                                                            <ListChecks size={13} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </Box>
                                            {isOwn && <Avatar src={currentUser?.avatar} sx={{ width: 28, height: 28 }} />}
                                        </Box>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </Box>

                            {/* Group Info Panel (Side) */}
                            {showGroupInfo && (
                                isMobile ? (
                                    <Drawer
                                        anchor="right"
                                        open={showGroupInfo}
                                        onClose={() => setShowGroupInfo(false)}
                                        PaperProps={{ sx: { width: 320, display: "flex", flexDirection: "column", height: "100%" } }}
                                    >
                                        {renderGroupInfoContent()}
                                    </Drawer>
                                ) : (
                                    <Box sx={{ width: 320, bgcolor: "background.paper", borderLeft: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", height: "100%" }}>
                                        {renderGroupInfoContent()}
                                    </Box>
                                )
                            )}
                        </Stack>
                        <Box sx={{ p: 2, pb: isMobile ? 8 : 2, bgcolor: "background.default", borderTop: "1px solid", borderColor: "divider" }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Tooltip title="Settings">
                                    <IconButton onClick={() => navigate("/settings")} sx={{ color: "text.secondary" }}>
                                        <Gear size={24} weight="bold" />
                                    </IconButton>
                                </Tooltip>
                                <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", bgcolor: "background.paper", p: "6px 12px", borderRadius: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", position: "relative", border: "1px solid", borderColor: "divider" }}>
                                    <Box sx={{ position: "absolute", bottom: "100%", right: 0, mb: 1, display: showEmojiPicker ? "block" : "none", zIndex: 10 }}>
                                        <EmojiPicker
                                            onEmojiClick={onEmojiClick}
                                            theme={isDark ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                                            lazyLoadEmojis={true}
                                        />
                                    </Box>
                                    <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
                                    <IconButton size="small" sx={{ color: "text.secondary" }} onClick={() => fileInputRef.current?.click()}>
                                        <Paperclip size={22} weight="bold" />
                                    </IconButton>
                                    <InputBase
                                        fullWidth
                                        multiline
                                        maxRows={4}
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                        sx={{ ml: 1, fontSize: 14 }}
                                    />
                                    <IconButton size="small" onClick={() => setShowEmojiPicker(!showEmojiPicker)} sx={{ color: showEmojiPicker ? "text.primary" : "text.secondary" }}>
                                        <Smiley size={22} weight="bold" />
                                    </IconButton>

                                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                                    <IconButton
                                        size="small"
                                        onClick={isRecording ? stopRecording : startRecording}
                                        sx={{ color: isRecording ? "#FF3B30" : "text.secondary", position: "relative" }}
                                    >
                                        <VideoCamera size={22} weight="bold" />
                                        {isRecording && (
                                            <Box sx={{
                                                position: "absolute", top: -2, right: -2, width: 8, height: 8,
                                                bgcolor: "#FF3B30", borderRadius: "50%", animation: "pulse 1s infinite"
                                            }} />
                                        )}
                                    </IconButton>

                                    <IconButton size="small" onClick={(e) => setTimerMenuAnchor(e.currentTarget)} sx={{ color: selfDestructSeconds > 0 ? "error.main" : "text.secondary" }}>
                                        <Hourglass size={22} weight={selfDestructSeconds > 0 ? "fill" : "bold"} />
                                        {selfDestructSeconds > 0 && (
                                            <Typography variant="caption" sx={{ ml: 0.5, fontWeight: "bold", fontSize: 10 }}>
                                                {selfDestructSeconds}s
                                            </Typography>
                                        )}
                                    </IconButton>

                                    <Menu
                                        anchorEl={timerMenuAnchor}
                                        open={Boolean(timerMenuAnchor)}
                                        onClose={() => setTimerMenuAnchor(null)}
                                        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                                        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                                    >
                                        <MenuItem onClick={() => { setSelfDestructSeconds(0); setTimerMenuAnchor(null); }}>Off</MenuItem>
                                        <MenuItem onClick={() => { setSelfDestructSeconds(5); setTimerMenuAnchor(null); }}>5s</MenuItem>
                                        <MenuItem onClick={() => { setSelfDestructSeconds(10); setTimerMenuAnchor(null); }}>10s</MenuItem>
                                        <MenuItem onClick={() => { setSelfDestructSeconds(30); setTimerMenuAnchor(null); }}>30s</MenuItem>
                                        <MenuItem onClick={() => { setSelfDestructSeconds(60); setTimerMenuAnchor(null); }}>60s</MenuItem>
                                    </Menu>
                                </Box>
                                <IconButton onClick={handleSend} disabled={!newMessage.trim()} sx={{ bgcolor: "text.primary", color: "background.paper", width: 44, height: 44, "&:hover": { bgcolor: "text.primary", opacity: 0.9 }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}>
                                    <PaperPlaneRight size={22} weight="fill" />
                                </IconButton>
                            </Stack>
                        </Box>
                    </Stack>
                ) : (
                    !isMobile && (
                        <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: isDark ? "background.default" : "#f8f9fa" }}>
                            <Box sx={{ p: 4, textAlign: "center", maxWidth: 400 }}>
                                <Users size={80} weight="thin" color={isDark ? "#444" : "#ccc"} />
                                <Typography variant="h6" fontWeight={700} mt={2}>Select a group</Typography>
                                <Typography variant="body2" color="text.secondary" mt={1}>Choose a group from the left to start messaging your team or friends.</Typography>
                                <Button
                                    variant="outlined"
                                    onClick={() => setCreateOpen(true)}
                                    startIcon={<Plus size={18} />}
                                    sx={{ mt: 3, textTransform: "none", borderRadius: 2, fontWeight: 700 }}
                                >
                                    Create New Group
                                </Button>
                            </Box>
                        </Box>
                    )
                )
            )}

            {/* ── Overlays ─────────────────────────────────────────────────── */}
            {isRecording && (
                <Box sx={{
                    position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
                    bgcolor: "rgba(0,0,0,0.9)", p: 2, borderRadius: 3, color: "#fff", zIndex: 1100,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2, boxShadow: "0 4px 30px rgba(0,0,0,0.5)",
                    width: 320,
                }}>
                    <Box sx={{ width: "100%", height: 200, bgcolor: "#222", borderRadius: 2, overflow: "hidden", border: "2px solid #fff" }}>
                        <video
                            autoPlay
                            muted
                            ref={(el) => { if (el && recordingStream) el.srcObject = recordingStream; }}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    </Box>
                    <Stack direction="row" alignItems="center" gap={2}>
                        <Box sx={{
                            width: 12, height: 12, bgcolor: "#FF3B30", borderRadius: "50%",
                            animation: "pulse 1.5s infinite",
                            "@keyframes pulse": {
                                "0%": { transform: "scale(1)", opacity: 1 },
                                "50%": { transform: "scale(1.2)", opacity: 0.7 },
                                "100%": { transform: "scale(1)", opacity: 1 },
                            }
                        }} />
                        <Typography variant="body2" fontWeight={600}>Recording... {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</Typography>
                        <IconButton onClick={discardRecording} sx={{ color: "#fff", bgcolor: "rgba(255,255,255,0.1)", "&:hover": { bgcolor: "rgba(255,255,255,0.2)" } }}>
                            <X size={18} />
                        </IconButton>
                    </Stack>
                    <Button
                        variant="contained"
                        onClick={stopRecording}
                        sx={{ bgcolor: "#FF3B30", color: "#fff", fontWeight: 700, "&:hover": { bgcolor: "#cc2e26" }, width: "100%" }}
                    >
                        Stop & Preview
                    </Button>
                </Box>
            )}

            {videoPreview && (
                <Box sx={{
                    position: "fixed", inset: 0, zIndex: 3000,
                    bgcolor: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", p: 4
                }}>
                    <Typography variant="h5" color="#fff" mb={3} fontWeight={700}>Video Preview</Typography>
                    <Box sx={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 2, overflow: "hidden", border: "2px solid #fff" }}>
                        <video src={videoPreview.url} controls autoPlay style={{ width: "100%", maxHeight: "60vh" }} />
                    </Box>
                    <Stack direction="row" spacing={3} mt={4}>
                        <Button
                            variant="outlined"
                            onClick={discardRecording}
                            sx={{ color: "#fff", borderColor: "#fff", "&:hover": { borderColor: "#ccc", color: "#ccc" } }}
                        >
                            Discard
                        </Button>
                        <Button
                            variant="contained"
                            onClick={sendVideoRecording}
                            sx={{ bgcolor: "#fff", color: "#000", fontWeight: 700, "&:hover": { bgcolor: "#eee" } }}
                        >
                            Send Video Message
                        </Button>
                    </Stack>
                </Box>
            )}

            {/* Create Group Dialog */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>Create New Group</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} mt={1}>
                        <TextField label="Group Name" fullWidth size="small" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                        <TextField
                            label="Add members by username"
                            fullWidth size="small"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            InputProps={{ startAdornment: <MagnifyingGlass size={16} style={{ marginRight: 8 }} /> }}
                        />
                        {memberResults.length > 0 && (
                            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, maxHeight: 160, overflowY: "auto" }}>
                                {memberResults.map((u) => (
                                    <Box key={u.id} sx={{ display: "flex", alignItems: "center", p: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                                        onClick={() => { if (!selectedMembers.find((m) => m.id === u.id)) setSelectedMembers([...selectedMembers, u]); setMemberSearch(""); setMemberResults([]); }}>
                                        <Avatar src={u.avatar} sx={{ width: 32, height: 32, mr: 1 }} />
                                        <Typography variant="body2">{u.username}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        )}
                        {selectedMembers.length > 0 && (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                {selectedMembers.map((m) => (
                                    <Chip key={m.id} label={m.username} avatar={<Avatar src={m.avatar} />} onDelete={() => setSelectedMembers(selectedMembers.filter((x) => x.id !== m.id))} size="small" />
                                ))}
                            </Box>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: "none", color: "text.secondary" }}>Cancel</Button>
                    <Button onClick={handleCreateGroup} variant="contained" sx={{ bgcolor: "text.primary", color: "background.paper", textTransform: "none", fontWeight: 700, borderRadius: 2, "&:hover": { bgcolor: "text.primary", opacity: 0.9 } }}>Create Group</Button>
                </DialogActions>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog open={addMemberOpen} onClose={() => { setAddMemberOpen(false); setAddSearch(""); setAddResults([]); }} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>Add Member to Group</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} mt={1}>
                        <TextField
                            label="Search user by username"
                            fullWidth size="small"
                            value={addSearch}
                            onChange={(e) => setAddSearch(e.target.value)}
                            InputProps={{ startAdornment: <MagnifyingGlass size={16} style={{ marginRight: 8 }} /> }}
                        />
                        {addResults.length > 0 && (
                            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, maxHeight: 200, overflowY: "auto" }}>
                                {addResults.map((u) => (
                                    <Box key={u.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5, "&:hover": { bgcolor: "action.hover" } }}>
                                        <Stack direction="row" alignItems="center">
                                            <Avatar src={u.avatar} sx={{ width: 32, height: 32, mr: 1 }} />
                                            <Typography variant="body2">{u.username}</Typography>
                                        </Stack>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => handleAddMember(u.username)}
                                            sx={{ textTransform: "none", bgcolor: "text.primary", color: "background.paper", borderRadius: 1.5, "&:hover": { bgcolor: "text.primary", opacity: 0.9 } }}
                                        >
                                            Add
                                        </Button>
                                    </Box>
                                ))}
                            </Box>
                        )}
                        {addSearch.trim() && addResults.length === 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", py: 2, display: "block" }}>
                                No users found matching "{addSearch}"
                            </Typography>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => { setAddMemberOpen(false); setAddSearch(""); setAddResults([]); }} sx={{ textTransform: "none", color: "text.secondary" }}>Close</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
                <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
            </Snackbar>

            {whiteboardOpen && (
                <WhiteboardDialog
                    open={whiteboardOpen}
                    onClose={() => setWhiteboardOpen(false)}
                    socket={socket}
                    chatId={activeGroup.id}
                    isGroup={true}
                    currentUser={currentUser}
                    authFetch={authFetch}
                    onSendImage={uploadAndSend}
                />
            )}

            {taskDialogOpen && (
                <ConvertToTaskDialog
                    open={taskDialogOpen}
                    onClose={() => setTaskDialogOpen(false)}
                    messageText={taskMessageText}
                    currentUser={currentUser}
                    authFetch={authFetch}
                    socket={socket}
                    onComplete={() => setSnackbar({ open: true, message: "Added to Kanban Board!", severity: "success" })}
                />
            )}
        </Stack>
    );
};

export default GroupsPage;
