import React, { useEffect, useState, useCallback } from "react";
import {
    Box, Stack, Avatar, Typography, Chip, Divider, CircularProgress, Tooltip, Button, useMediaQuery, useTheme
} from "@mui/material";
import { Phone, VideoCamera, PhoneIncoming, PhoneOutgoing, PhoneX } from "phosphor-react";
import { useAuth } from "../../contexts/AuthContext";

import { API_BASE } from "../../constants";

const formatDuration = (secs) => {
    if (!secs || secs === 0) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
};

const STATUS_META = {
    accepted: { label: "Accepted", color: "success" },
    declined: { label: "Declined", color: "error" },
    missed: { label: "Missed", color: "warning" },
    calling: { label: "Calling", color: "default" },
};

const CallHistoryPage = () => {
    const { authFetch, currentUser } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/calls/history`);
            const data = await res.json();
            setLogs(Array.isArray(data) ? data : []);
        } catch {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const isOutgoing = (log) => log.caller_id === currentUser?.id;

    return (
        <Box sx={{
            flexGrow: 1, height: "100vh", display: "flex", flexDirection: "column",
            bgcolor: "background.default",
        }}>
            {/* Header */}
            <Box sx={{
                p: isMobile ? 2 : 3, bgcolor: "background.paper",
                borderBottom: "1px solid", borderColor: "divider",
                display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>Call History</Typography>
                    <Typography variant="caption" color="text.secondary">
                        Your recent audio and video calls
                    </Typography>
                </Box>
                <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={fetchHistory}
                    disabled={loading}
                    sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                >
                    Refresh
                </Button>
            </Box>

            {/* List */}
            <Box sx={{ flexGrow: 1, overflowY: "auto", p: isMobile ? 2 : 3 }}>
                {loading ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ height: 300 }}>
                        <CircularProgress sx={{ color: "#000" }} />
                    </Stack>
                ) : logs.length === 0 ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ height: 300, gap: 2 }}>
                        <Phone size={56} weight="light" style={{ opacity: 0.2 }} />
                        <Typography color="text.secondary">No calls yet</Typography>
                    </Stack>
                ) : (
                    <Stack spacing={1}>
                        {logs.map((log, i) => {
                            const outgoing = isOutgoing(log);
                            const isGroupCall = log.group_id !== null;
                            const otherName = isGroupCall ? log.group_name : (outgoing ? log.receiver_name : log.caller_name);
                            const otherAvatar = isGroupCall ? log.group_avatar : (outgoing ? log.receiver_avatar : log.caller_avatar);
                            const duration = formatDuration(log.duration_seconds);
                            const statusMeta = STATUS_META[log.status] || STATUS_META.calling;

                            let DirectionIcon = outgoing ? PhoneOutgoing : PhoneIncoming;
                            if (log.status === "missed" || log.status === "declined")
                                DirectionIcon = PhoneX;

                            return (
                                <React.Fragment key={log.id}>
                                    <Box sx={{
                                        display: "flex", alignItems: "center", gap: 2,
                                        p: 2, borderRadius: 2,
                                        bgcolor: "background.paper",
                                        border: "1px solid", borderColor: "divider",
                                        transition: "box-shadow 0.2s",
                                        "&:hover": { boxShadow: "0 2px 12px rgba(0,0,0,0.07)" },
                                    }}>
                                        {/* Avatar */}
                                        <Avatar src={otherAvatar} sx={{ width: 48, height: 48 }} />

                                        {/* Info */}
                                        <Stack flexGrow={1} spacing={0.3}>
                                            <Typography fontWeight={700}>{otherName}</Typography>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Tooltip title={outgoing ? "Outgoing" : "Incoming"}>
                                                    <DirectionIcon
                                                        size={15}
                                                        weight="bold"
                                                        color={
                                                            log.status === "missed" || log.status === "declined"
                                                                ? "#f44336"
                                                                : outgoing ? "#757575" : "#4CAF50"
                                                        }
                                                    />
                                                </Tooltip>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatDate(log.created_at)}
                                                </Typography>
                                                {duration && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        · {duration}
                                                    </Typography>
                                                )}
                                            </Stack>
                                            {isGroupCall && log.participants && log.participants.length > 0 && (
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                        Joined:
                                                    </Typography>
                                                    <Stack direction="row" spacing={-0.8}>
                                                        {log.participants.map((p) => (
                                                            <Tooltip key={p.id} title={p.username}>
                                                                 <Avatar 
                                                                     src={p.avatar} 
                                                                     sx={{ 
                                                                         width: 22, height: 22, 
                                                                         border: "1.5px solid", 
                                                                         borderColor: "background.paper"
                                                                     }} 
                                                                 />
                                                            </Tooltip>
                                                        ))}
                                                    </Stack>
                                                </Stack>
                                            )}
                                        </Stack>

                                        {/* Right side: type icon + status chip */}
                                        <Stack alignItems="flex-end" spacing={0.8}>
                                            <Box sx={{ color: "text.secondary" }}>
                                                {log.call_type === "video"
                                                    ? <VideoCamera size={18} weight="bold" />
                                                    : <Phone size={18} weight="bold" />
                                                }
                                            </Box>
                                            <Chip
                                                label={statusMeta.label}
                                                color={statusMeta.color}
                                                size="small"
                                                sx={{ fontWeight: 600, fontSize: 11 }}
                                            />
                                        </Stack>
                                    </Box>
                                    {i < logs.length - 1 && <Divider />}
                                </React.Fragment>
                            );
                        })}
                    </Stack>
                )}
            </Box>
        </Box>
    );
};

export default CallHistoryPage;
