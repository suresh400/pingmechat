import { Avatar, Box, IconButton, Stack, Tooltip, Snackbar, Alert, useMediaQuery, useTheme, BottomNavigation, BottomNavigationAction, Paper, Badge } from "@mui/material";
import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ChatCircleDots, Users, PhoneCall, Gear, SignOut, Kanban } from "phosphor-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import AgoraCallModal from "../../components/AgoraCallModal";
import { API_BASE } from "../../constants";

const NAV_ITEMS = [
  { index: 0, icon: <ChatCircleDots size={22} />, label: "Chats", path: "/app" },
  { index: 1, icon: <Users size={22} />, label: "Groups", path: "/groups" },
  { index: 2, icon: <PhoneCall size={22} />, label: "Calls", path: "/calls" },
  { index: 3, icon: <Kanban size={22} />, label: "Tasks", path: "/tasks" },
  { index: 4, icon: <Gear size={22} />, label: "Settings", path: "/settings" },
];

const DashboardLayout = () => {
  const [selected, setSelected] = useState(0);
  const { currentUser, logout, authFetch } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    const path = window.location.pathname;
    const item = NAV_ITEMS.find((n) => n.path === path);
    if (item) setSelected(item.index);
  }, [navigate]);

  const fetchTotalUnread = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`${API_BASE}/messages/unread/total`);
      if (res.ok) {
        const data = await res.json();
        setTotalUnread(data.total || 0);
      }
    } catch (err) {
      console.error("[fetchTotalUnread] Error:", err);
    }
  }, [authFetch, currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchTotalUnread();
    }
  }, [currentUser, fetchTotalUnread]);

  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) PingMe`;
    } else {
      document.title = "PingMe";
    }
  }, [totalUnread]);

  // ── Global Call State ────────────────────────────────────────────────────────
  const [callState, setCallState] = useState({ open: false, type: null, contact: null, isIncoming: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  // ── Incoming call socket events (global — works on any page) ──────────────
  useEffect(() => {
    if (!socket) return;

    socket.on("incoming_call", (data) => {
      setCallState({
        open: true,
        type: data.type,
        contact: { id: data.from, username: data.callerName, avatar: data.callerAvatar },
        isIncoming: true,
        callLogId: data.callLogId || null,
        isGroup: false,
      });
      // Browser notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`Incoming ${data.type} call from ${data.callerName}`, {
          icon: data.callerAvatar,
        });
      }
    });

    socket.on("incoming_group_call", (data) => {
      setCallState({
        open: true,
        type: data.type,
        contact: { id: data.groupId, username: data.groupName, avatar: data.groupAvatar },
        isIncoming: true,
        callLogId: data.callLogId || null,
        isGroup: true,
      });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`Incoming group ${data.type} call from ${data.callerName} in ${data.groupName}`, {
          icon: data.groupAvatar,
        });
      }
    });

    socket.on("group_call_cancelled", (data) => {
      setCallState(prev => {
        if (prev.open && prev.isGroup && Number(prev.contact?.id) === Number(data.group_id)) {
          return { open: false, type: null, contact: null, isIncoming: false, callLogId: null, isGroup: false };
        }
        return prev;
      });
    });

    // Server sends callLogId back to caller after creating the log
    socket.on("call_started", (data) => {
      setCallState(prev => ({ ...prev, callLogId: data.callLogId }));
    });

    socket.on("call_declined", () => {
      setCallState({ open: false, type: null, contact: null, isIncoming: false, callLogId: null, isGroup: false });
      setSnackbar({ open: true, message: "Call was declined", severity: "error" });
    });

    socket.on("call_cancelled", () => {
      setCallState({ open: false, type: null, contact: null, isIncoming: false, callLogId: null, isGroup: false });
      setSnackbar({ open: true, message: "Call cancelled", severity: "info" });
    });

    socket.on("call_accepted", () => {
      setSnackbar({ open: true, message: "Call accepted! Connecting...", severity: "success" });
    });

    socket.on("call_log_updated", (log) => {
      setCallState(prev => {
        if (prev.open && Number(prev.callLogId) === Number(log.id)) {
          setSnackbar({ open: true, message: "Call ended", severity: "info" });
          return { open: false, type: null, contact: null, isIncoming: false, callLogId: null, isGroup: false };
        }
        return prev;
      });
    });

    socket.on("receive_message", (msg) => {
      if (currentUser && Number(msg.receiver_id) === Number(currentUser.id)) {
        fetchTotalUnread();
      }
    });

    socket.on("message_read", () => {
      fetchTotalUnread();
    });

    return () => {
      socket.off("incoming_call");
      socket.off("incoming_group_call");
      socket.off("group_call_cancelled");
      socket.off("call_started");
      socket.off("call_declined");
      socket.off("call_cancelled");
      socket.off("call_accepted");
      socket.off("call_log_updated");
      socket.off("receive_message");
      socket.off("message_read");
    };
  }, [socket, currentUser, fetchTotalUnread]);

  const answerCall = useCallback(() => {
    // No-op: AgoraCallModal handles accept_call emit with callLogId directly
  }, []);

  const declineCall = useCallback(() => {
    // No-op: AgoraCallModal handles decline_call/end_call emit natively
    setCallState({ open: false, type: null, contact: null, isIncoming: false, callLogId: null });
  }, []);

  const handleNav = (item) => {
    setSelected(item.index);
    navigate(item.path);
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <Stack direction={isMobile ? "column" : "row"} sx={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
      {/* Desktop/Tablet Side Rail */}
      {!isMobile && (
        <Box sx={{
          width: 76,
          bgcolor: "background.paper",
          boxShadow: "2px 0 10px rgba(0,0,0,0.06)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          py: 2,
          borderRight: "1px solid",
          borderColor: "divider",
          zIndex: 10,
        }}>
          {/* Logo */}
          <Tooltip title="PingMe" placement="right">
            <Box sx={{ width: 48, height: 48, bgcolor: "#000", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", mb: 3, cursor: "pointer" }}
              onClick={() => navigate("/app")}>
              <ChatCircleDots size={26} color="#fff" weight="fill" />
            </Box>
          </Tooltip>

          {/* Nav */}
          <Stack flexGrow={1} alignItems="center" spacing={1}>
            {NAV_ITEMS.map((item) => (
              <Tooltip key={item.index} title={item.label} placement="right">
                <Box
                  onClick={() => handleNav(item)}
                  sx={{
                    width: 48, height: 48, borderRadius: 2, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: selected === item.index ? "#000" : "transparent",
                    color: selected === item.index ? "#fff" : "text.secondary",
                    transition: "all 0.2s",
                    "&:hover": { bgcolor: selected === item.index ? "#333" : "action.hover", color: selected === item.index ? "#fff" : "#000" },
                  }}
                >
                  {item.label === "Chats" && totalUnread > 0 ? (
                    <Badge badgeContent={totalUnread} color="error" max={99}>
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </Box>
              </Tooltip>
            ))}
          </Stack>

          {/* Bottom: logout + avatar */}
          <Stack alignItems="center" spacing={1.5}>
            <Tooltip title="Logout" placement="right">
              <IconButton onClick={handleLogout} size="small" sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
                <SignOut size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title={currentUser?.username || "Profile"} placement="right">
              <Avatar src={currentUser?.avatar} sx={{ width: 38, height: 38, border: "2px solid #000", cursor: "pointer" }} onClick={() => navigate("/settings")} />
            </Tooltip>
          </Stack>
        </Box>
      )}

      {/* Page content */}
      <Box sx={{ flexGrow: 1, display: "flex", overflow: "hidden", height: isMobile ? "calc(100vh - 56px)" : "100vh" }}>
        <Outlet context={{ callState, setCallState, socket, fetchTotalUnread }} />
      </Box>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1200 }} elevation={8}>
          <BottomNavigation
            showLabels
            value={selected}
            onChange={(event, newValue) => {
              const item = NAV_ITEMS.find((n) => n.index === newValue);
              if (item) handleNav(item);
            }}
            sx={{
              "& .MuiBottomNavigationAction-root.Mui-selected": {
                color: "#000",
              },
            }}
          >
            {NAV_ITEMS.map((item) => (
              <BottomNavigationAction
                key={item.index}
                label={item.label}
                icon={
                  item.label === "Chats" && totalUnread > 0 ? (
                    <Badge badgeContent={totalUnread} color="error" max={99}>
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )
                }
                value={item.index}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}

      {/* ── Global Incoming Call Modal (shown on ANY page) ─────────────────── */}
      <AgoraCallModal
        callState={callState}
        currentUser={currentUser}
        authFetch={authFetch}
        socket={socket}
        onAccept={answerCall}
        onDecline={declineCall}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(p => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default DashboardLayout;
