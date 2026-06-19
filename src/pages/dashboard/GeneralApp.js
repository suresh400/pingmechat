import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box, Stack, Avatar, Typography, InputBase, IconButton,
  Divider, Tooltip, Chip, CircularProgress, Snackbar, Alert, Menu, MenuItem, useMediaQuery, useTheme
} from "@mui/material";
import {
  MagnifyingGlass, Phone, VideoCamera, Info, PaperPlaneRight, CaretLeft,
  Paperclip, Smiley, Prohibit, Trash, SignOut, X, Gear,
  PhoneIncoming, PhoneOutgoing, DotsThreeVertical, DownloadSimple, FileText, Check, Checks,
} from "phosphor-react";
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import useSettings from "../../hooks/useSettings";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { useNavigate, useOutletContext } from "react-router-dom";

import { API_BASE, BASE_URL } from "../../constants";

const GeneralApp = () => {
  const { currentUser, authFetch, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  const { themeMode } = useSettings();
  const theme = useTheme();
  const isDark = themeMode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Contacts (search-only for privacy)
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Active conversation
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const [blockedUsers, setBlockedUsers] = useState(new Set());
  const [showContactInfo, setShowContactInfo] = useState(false);

  // Conversations Persistence
  const [activeConversations, setActiveConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  // ── Get global call state from DashboardLayout via Outlet context ──────────
  const outletCtx = useOutletContext() || {};
  const { setCallState, fetchTotalUnread } = outletCtx;

  const [mediaStream, setMediaStream] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  const fileInputRef = useRef(null);

  const fetchActiveConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/contacts/active`);
      const data = await res.json();
      console.log("[fetchActiveConversations] Data:", data);
      setActiveConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[fetchActiveConversations] Error:", err);
      setActiveConversations([]);
    }
    finally { setConversationsLoading(false); }
  }, [authFetch]);

  useEffect(() => { fetchActiveConversations(); }, [fetchActiveConversations]);

  const fetchBlockedUsers = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/contacts/blocked`);
      const data = await res.json();
      console.log("[fetchBlockedUsers] IDs:", data);
      setBlockedUsers(new Set(Array.isArray(data) ? data : []));
    } catch (err) {
      console.error("[fetchBlockedUsers] Error:", err);
      setBlockedUsers(new Set());
    }
  }, [authFetch]);

  useEffect(() => { fetchBlockedUsers(); }, [fetchBlockedUsers]);

  // Browser Notifications
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const showNotification = useCallback((title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  }, []);

  // ── Username search (privacy: only show results when searching) ─────────────
  useEffect(() => {
    if (!search.trim()) { setContacts([]); setHasSearched(false); return; }
    const timer = setTimeout(async () => {
      setHasSearched(true);
      try {
        const res = await authFetch(`${API_BASE}/contacts/search?username=${encodeURIComponent(search)}`);
        const data = await res.json();
        setContacts(Array.isArray(data) ? data : []);
      } catch { setContacts([]); }
    }, 350);
    return () => clearTimeout(timer);
  }, [search, authFetch]);

  // ── Fetch message history ───────────────────────────────────────────────────
  const fetchMessages = useCallback(async (contactId) => {
    setMessagesLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/messages/${contactId}`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
      fetchActiveConversations();
      if (fetchTotalUnread) fetchTotalUnread();
    } catch { setMessages([]); }
    finally { setMessagesLoading(false); }
  }, [authFetch, fetchActiveConversations, fetchTotalUnread]);

  useEffect(() => { if (activeContact) fetchMessages(activeContact.id); }, [activeContact, fetchMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Socket.io: receive realtime messages ────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      // Only update if the message belongs to the active conversation
      if (
        activeContact &&
        ((Number(msg.sender_id) === Number(activeContact.id) && Number(msg.receiver_id) === Number(currentUser?.id)) ||
          (Number(msg.sender_id) === Number(currentUser?.id) && Number(msg.receiver_id) === Number(activeContact.id)))
      ) {
        setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
        // If we are the receiver of this message in an active chat, mark as read
        if (Number(msg.receiver_id) === Number(currentUser?.id) && Number(msg.sender_id) === Number(activeContact.id)) {
          socket.emit("mark_read", { messageId: msg.id, sender_id: msg.sender_id });
          setTimeout(() => {
            fetchActiveConversations();
            if (fetchTotalUnread) fetchTotalUnread();
          }, 100);
        }
      } else if (msg.receiver_id === currentUser?.id) {
        showNotification(`New message from ${msg.sender_name}`, msg.message);
        fetchActiveConversations(); // Update sidebar
      }
    };

    const readHandler = (data) => {
      setMessages((prev) => prev.map(m => m.id === data.messageId ? { ...m, is_read: 1 } : m));
    };

    socket.on("receive_message", handler);
    socket.on("message_read", readHandler);

    socket.on("user_status_update", (data) => {
      const { userId, is_online, last_seen } = data;
      const uid = Number(userId);
      console.log(`[StatusEvent] User ${uid} update | Online: ${!!is_online} | Last Seen: ${last_seen}`);

      // Update sidebar
      setActiveConversations(prev => prev.map(c =>
        Number(c.id) === uid ? { ...c, is_online: Number(is_online), last_seen } : c
      ));

      // Update active contact if it matches
      if (activeContact && Number(activeContact.id) === uid) {
        setActiveContact(prev => ({ ...prev, is_online: Number(is_online), last_seen }));
      }
    });

    socket.on("message_blocked", (data) => {
      const { receiver_id, _originalData } = data;
      if (activeContact && activeContact.id === receiver_id) {
        setMessages(prev => [...prev, {
          ..._originalData,
          id: `fail_${Date.now()}`,
          _blocked: true,
          created_at: new Date().toISOString()
        }]);
      }
    });

    return () => {
      socket.off("receive_message", handler);
      socket.off("message_read", readHandler);
      socket.off("user_status_update");
      socket.off("message_blocked");
    };
  }, [socket, activeContact, currentUser?.id, fetchActiveConversations, showNotification, fetchTotalUnread]);

  // Listen for call_log_updated to append a call bubble to chat
  useEffect(() => {
    if (!socket || !currentUser) return;
    const handleCallLog = (log) => {
      // Only add bubble if this conversation is active
      if (
        activeContact &&
        ((Number(log.caller_id) === Number(currentUser.id) && Number(log.receiver_id) === Number(activeContact.id)) ||
          (Number(log.receiver_id) === Number(currentUser.id) && Number(log.caller_id) === Number(activeContact.id)))
      ) {
        const isOutgoing = Number(log.caller_id) === Number(currentUser.id);
        const duration = log.duration_seconds > 0
          ? ` · ${Math.floor(log.duration_seconds / 60)}m ${log.duration_seconds % 60}s`
          : "";
        const label = `${log.call_type === "video" ? "📹" : "📞"} ${isOutgoing ? "Outgoing" : "Incoming"} ${log.call_type} call — ${log.status}${duration}`;
        setMessages(prev => [...prev, {
          id: `call_${log.id}`,
          sender_id: log.caller_id,
          receiver_id: log.receiver_id,
          message: label,
          _isCallEvent: true,
          _callStatus: log.status,
          created_at: log.ended_at || log.created_at,
        }]);
      }
    };
    socket.on("call_log_updated", handleCallLog);
    return () => socket.off("call_log_updated", handleCallLog);
  }, [socket, activeContact, currentUser]);

  const startCall = (type) => {
    if (!activeContact || !setCallState) return;
    setCallState({ open: true, type, contact: activeContact, isIncoming: false });
    socket.emit("start_call", {
      sender_id: currentUser.id,
      receiver_id: activeContact.id,
      type,
      callerName: currentUser.username,
      callerAvatar: currentUser.avatar
    });
  };

  // ── Send message via socket ─────────────────────────────────────────────────
  const handleSend = () => {
    if (!newMessage.trim() || !activeContact || !socket) return;

    // Client-side block check
    if (blockedUsers.has(activeContact.id)) {
      setSnackbar({ open: true, message: "Unblock user to send messages", severity: "error" });
      return;
    }

    socket.emit("send_message", {
      sender_id: currentUser.id,
      receiver_id: activeContact.id,
      message: newMessage.trim(),
      sender_name: currentUser.username,
      sender_avatar: currentUser.avatar,
    });
    setNewMessage("");
    setShowEmojiPicker(false);
    fetchActiveConversations(); // Ensure contact is in sidebar
  };

  const uploadAndSend = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await authFetch(`${API_BASE}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Send immediately as a message
      socket.emit("send_message", {
        sender_id: currentUser.id,
        receiver_id: activeContact.id,
        message: data.url,
        sender_name: currentUser.username,
        sender_avatar: currentUser.avatar,
      });
      fetchActiveConversations();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: "error" });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeContact) return;
    await uploadAndSend(file);
    e.target.value = null; // Clear input
  };



  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const onEmojiClick = (emojiData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const handleSelectContact = (contact) => {
    setActiveContact(contact);
    setSearch(""); // Clear search on select
    setContacts([]);
    setHasSearched(false);
  };

  const blockContact = async () => {
    if (!activeContact) return;
    console.log(`[blockContact] Triggered for ID: ${activeContact.id}`);
    try {
      const res = await authFetch(`${API_BASE}/contacts/block`, {
        method: "POST",
        body: JSON.stringify({ contactId: activeContact.id })
      });
      console.log(`[blockContact] Response status: ${res.status}`);
      setBlockedUsers(prev => new Set([...prev, activeContact.id]));
      setSnackbar({ open: true, message: "User blocked", severity: "warning" });
      fetchActiveConversations(); // Sync presence/status
    } catch (err) {
      console.error("[blockContact] Error:", err);
      setSnackbar({ open: true, message: err.message, severity: "error" });
    }
  };

  const unblockContact = async () => {
    if (!activeContact) return;
    console.log(`[unblockContact] Triggered for ID: ${activeContact.id}`);
    try {
      const res = await authFetch(`${API_BASE}/contacts/unblock`, {
        method: "POST",
        body: JSON.stringify({ contactId: activeContact.id })
      });
      console.log(`[unblockContact] Response status: ${res.status}`);
      setBlockedUsers(prev => {
        const next = new Set(prev);
        next.delete(activeContact.id);
        return next;
      });
      setSnackbar({ open: true, message: "User unblocked", severity: "success" });
      fetchActiveConversations();
    } catch (err) {
      console.error("[unblockContact] Error:", err);
      setSnackbar({ open: true, message: err.message, severity: "error" });
    }
  };

  const deleteChat = async () => {
    if (!activeContact) return;
    if (!window.confirm("Are you sure you want to delete this entire conversation?")) return;
    try {
      await authFetch(`${API_BASE}/messages/${activeContact.id}`, { method: "DELETE" });
      setMessages([]);
      setSnackbar({ open: true, message: "Conversation deleted", severity: "info" });
    } catch (err) { setSnackbar({ open: true, message: err.message, severity: "error" }); }
  };

  // ── Media permissions ───────────────────────────────────────────────────────
  const stopMedia = () => { if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); setMediaStream(null); } };

  const getFileUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `${BASE_URL}${path}`;
  };

  const handleLogout = () => { stopMedia(); logout(); navigate("/login"); };
  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const formatLastSeen = (ts) => {
    if (!ts) return "Offline";
    const d = new Date(ts);
    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
    return `Last seen ${timeStr}`;
  };

  const [anchorEl, setAnchorEl] = useState(null);
  const handleOpenMenu = (e) => setAnchorEl(e.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  return (
    <Stack direction="row" sx={{ width: "100%", height: "100%" }}>
      {/* ── 1. Contacts Panel ──────────────────────────────────────────────── */}
      {(!isMobile || !activeContact) && (
        <Box sx={{
          width: isMobile ? "100%" : 320,
          bgcolor: "background.paper",
          height: "100%",
          boxShadow: "2px 0 5px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0
        }}>
          <Box p={2} pb={1.5}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Typography variant="h6" fontWeight={700}>Chats</Typography>
              <Tooltip title="Logout">
                <IconButton size="small" onClick={handleLogout} sx={{ color: "text.secondary" }}>
                  <SignOut size={20} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", bgcolor: "action.hover", borderRadius: 2, p: "6px 12px", gap: 1 }}>
              <MagnifyingGlass size={18} />
              <InputBase fullWidth placeholder="Search by username..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ fontSize: 14 }} />
              {search && <IconButton size="small" onClick={() => setSearch("")} sx={{ p: 0 }}><X size={14} /></IconButton>}
            </Box>
          </Box>
          <Divider />
          <Box sx={{ flexGrow: 1, overflowY: "auto", p: 1 }}>
            {conversationsLoading && activeConversations.length === 0 && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress size={24} sx={{ color: "text.secondary" }} /></Box>
            )}

            {/* Search Results */}
            {hasSearched && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5, mb: 0.5, display: "block", fontWeight: 600, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>Search Results</Typography>
                {contacts.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>No users found</Typography>
                ) : contacts.map((contact) => (
                  <Box
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    sx={{
                      display: "flex", alignItems: "center", p: 1.5, borderRadius: 2, cursor: "pointer", mb: 0.5,
                      bgcolor: activeContact?.id === contact.id ? (isDark ? "rgba(255,255,255,0.08)" : "#f0f0f0") : "transparent",
                      "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5" },
                    }}
                  >
                    <Avatar src={contact.avatar} sx={{ width: 44, height: 44 }} />
                    <Box sx={{ ml: 1.5, flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap fontWeight={700}>{contact.username}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{contact.bio || "No bio yet"}</Typography>
                    </Box>
                  </Box>
                ))}
                <Divider sx={{ my: 1 }} />
              </Box>
            )}

            {/* Active Conversations */}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5, mb: 1, display: "block", fontWeight: 600, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>All Messages</Typography>
            {activeConversations.length === 0 && !hasSearched ? (
              <Box sx={{ textAlign: "center", mt: 8, px: 2 }}>
                <MagnifyingGlass size={36} color="#ccc" />
                <Typography variant="body2" color="text.secondary" mt={1}>Search for someone to start a conversation</Typography>
              </Box>
            ) : activeConversations.map((conv) => (
              <Box
                key={conv.id}
                onClick={() => handleSelectContact(conv)}
                sx={{
                  display: "flex", alignItems: "center", p: 1.5, borderRadius: 2, cursor: "pointer", mb: 0.5,
                  bgcolor: activeContact?.id === conv.id ? (isDark ? "rgba(255,255,255,0.08)" : "#f0f0f0") : "transparent",
                  "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5" },
                }}
              >
                <Avatar src={conv.avatar} sx={{ width: 44, height: 44 }} />
                <Box sx={{ ml: 1.5, flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" noWrap fontWeight={700}>{conv.username}</Typography>
                    {Number(conv.is_online) === 1 && <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4CAF50", border: `1.5px solid ${isDark ? "#121212" : "#fff"}` }} />}
                  </Stack>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: "80%" }}>
                      {Number(conv.is_online) === 1 ? "Online" : formatLastSeen(conv.last_seen)}
                    </Typography>
                    {conv.unread_count > 0 && (
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
                        textAlign: "center"
                      }}>
                        {conv.unread_count}
                      </Box>
                    )}
                  </Stack>
                </Box>
              </Box>
            ))}
          </Box>
          <Divider />
          {/* Logged-in user */}
          <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1.5, bgcolor: "background.neutral" }}>
            <Avatar src={currentUser?.avatar} sx={{ width: 36, height: 36 }} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{currentUser?.username}</Typography>
            </Box>
            <Chip label="Online" size="small" sx={{ bgcolor: "#E8F5E9", color: "#388E3C", fontSize: 10, height: 20 }} />
          </Box>
        </Box>
      )}

      {/* ── 2. Conversation ────────────────────────────────────────────────── */}
      {(!isMobile || activeContact) && (
        activeContact ? (
          <Stack sx={{ flexGrow: 1, height: "100%", width: isMobile ? "100%" : "auto" }}>
            <Box sx={{ p: 2, bgcolor: "background.paper", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid", borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                {isMobile && (
                  <IconButton onClick={() => setActiveContact(null)} sx={{ color: "text.primary", mr: -0.5 }}>
                    <CaretLeft size={24} weight="bold" />
                  </IconButton>
                )}
                <Avatar src={activeContact.avatar} sx={{ width: 40, height: 40 }} />
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={700}>{activeContact.username}</Typography>
                    {blockedUsers.has(activeContact.id) && (
                      <Chip label="Blocked" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                    )}
                  </Stack>
                  <Typography variant="caption" sx={{ color: Number(activeContact.is_online) === 1 ? "#4CAF50" : "text.secondary" }}>
                    {Number(activeContact.is_online) === 1 ? "Online" : formatLastSeen(activeContact.last_seen)}
                  </Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Audio Call">
                  <IconButton
                    onClick={() => startCall("audio")}
                    sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
                  >
                    <Phone size={22} weight="bold" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Video Call">
                  <IconButton
                    onClick={() => startCall("video")}
                    sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
                  >
                    <VideoCamera size={22} weight="bold" />
                  </IconButton>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <IconButton onClick={handleOpenMenu} sx={{ color: "text.secondary" }}>
                  <DotsThreeVertical size={22} weight="bold" />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleCloseMenu}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                >
                  {blockedUsers.has(activeContact.id) ? (
                    <MenuItem onClick={() => { unblockContact(); handleCloseMenu(); }} sx={{ color: "#4CAF50", gap: 1.5 }}>
                      <Prohibit size={20} /> <Typography variant="body2" fontWeight={600}>Unblock User</Typography>
                    </MenuItem>
                  ) : (
                    <MenuItem onClick={() => { blockContact(); handleCloseMenu(); }} sx={{ color: "#f44336", gap: 1.5 }}>
                      <Prohibit size={20} /> <Typography variant="body2" fontWeight={600}>Block User</Typography>
                    </MenuItem>
                  )}
                  <MenuItem onClick={() => { deleteChat(); handleCloseMenu(); }} sx={{ color: "#f44336", gap: 1.5 }}>
                    <Trash size={20} /> <Typography variant="body2" fontWeight={600}>Delete Chat</Typography>
                  </MenuItem>
                  <MenuItem onClick={() => { setShowContactInfo(!showContactInfo); handleCloseMenu(); }} sx={{ gap: 1.5 }}>
                    <Info size={20} /> <Typography variant="body2" fontWeight={600}>{showContactInfo ? "Hide" : "Show"} Contact Info</Typography>
                  </MenuItem>
                </Menu>
              </Stack>
            </Box>

            <Stack direction="row" sx={{ flexGrow: 1, overflow: "hidden" }}>
              <Box sx={{
                flexGrow: 1,
                height: "100%",
                overflowY: "auto",
                p: 3,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                bgcolor: isDark ? "background.default" : "#e5ddd5",
                backgroundImage: isDark ? "none" : "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                backgroundBlendMode: "overlay",
                backgroundRepeat: "repeat",
                position: "relative"
              }}>
                {messagesLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress size={24} sx={{ color: "text.primary" }} /></Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ textAlign: "center", mt: 8 }}>
                    <Typography variant="body2" color="text.secondary">No messages yet — say hi! 👋</Typography>
                  </Box>
                ) : messages.map((msg) => {
                  const isOwn = Number(msg.sender_id) === Number(currentUser?.id);

                  // ── Call event bubble ────────────────────────────────────────────
                  if (msg._isCallEvent) {
                    const isAccepted = msg._callStatus === "accepted";
                    return (
                      <Box key={msg.id} sx={{ display: "flex", justifyContent: "center", my: 0.5 }}>
                        <Box sx={{
                          display: "inline-flex", alignItems: "center", gap: 0.8,
                          px: 2, py: 0.7, borderRadius: 99,
                          bgcolor: isAccepted ? "rgba(76,175,80,0.08)" : "rgba(244,67,54,0.07)",
                          border: "1px solid", borderColor: isAccepted ? "rgba(76,175,80,0.3)" : "rgba(244,67,54,0.25)",
                        }}>
                          {msg.sender_id === currentUser?.id
                            ? <PhoneOutgoing size={13} color={isAccepted ? "#4CAF50" : "#f44336"} weight="bold" />
                            : <PhoneIncoming size={13} color={isAccepted ? "#4CAF50" : "#f44336"} weight="bold" />
                          }
                          <Typography sx={{ fontSize: 12, color: isAccepted ? "#388E3C" : "#c62828", fontWeight: 500 }}>
                            {msg.message}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  }

                  return (
                    <Box key={msg.id} sx={{ display: "flex", alignItems: "flex-end", justifyContent: isOwn ? "flex-end" : "flex-start", gap: 1 }}>
                      {!isOwn && <Avatar src={msg.sender_avatar} sx={{ width: 28, height: 28 }} />}
                      <Box>
                        <Box sx={{
                          bgcolor: msg._blocked ? (isDark ? "error.dark" : "#ffcdd2") : (isOwn ? (isDark ? "#2c6c44" : "#E3F2FD") : (isDark ? "background.paper" : "#F5F5F5")),
                          color: msg._blocked ? (isDark ? "#fff" : "#b71c1c") : (isOwn ? "text.primary" : "text.primary"),
                          p: "10px 14px",
                          borderRadius: isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          border: "1px solid",
                          borderColor: msg._blocked ? "error.main" : (isOwn ? (isDark ? "#388E3C" : "#90CAF9") : "divider"),
                          maxWidth: { xs: "280px", sm: "380px" },
                          boxShadow: isOwn ? "0px 2px 4px rgba(33, 150, 243, 0.15)" : "0px 2px 4px rgba(0,0,0,0.06)",
                        }}>
                          {(() => {
                            const messageText = String(msg.message || "").trim();
                            const looksLikeLink = messageText.startsWith("http");
                            const isUpload = messageText.includes("/uploads") || messageText.includes("\\uploads");
                            const isImage = messageText.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i);
                            const isVideo = messageText.match(/\.(webm|mp4|ogg)(\?.*)?$/i);

                            if (looksLikeLink) {
                              console.log(`[MessageRender] Link found: "${messageText}" | isUpload: ${isUpload} | isImage: ${!!isImage}`);
                            }

                            // 1. Video Check
                            if (isVideo && (isUpload || looksLikeLink)) {
                              return (
                                <Box sx={{ position: "relative", borderRadius: 1, overflow: "hidden", mb: 0.5 }}>
                                  <video src={getFileUrl(messageText)} controls style={{ width: "100%", borderRadius: "8px", display: "block" }} />
                                </Box>
                              );
                            }

                            // 2. Image Check
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
                                    cursor: "pointer",
                                    bgcolor: "background.default"
                                  }}
                                  onClick={() => window.open(getFileUrl(messageText), "_blank")}
                                  onError={(e) => {
                                    console.error("[ImageRender] Failed to load:", getFileUrl(messageText));
                                    e.target.style.display = 'none';
                                  }}
                                />
                              );
                            }

                            // 3. Other Uploads (Docs, etc)
                            if (isUpload) {
                              const fileName = messageText.split(/[/\\]/).pop().split("-").slice(2).join("-") || "File Attachment";
                              return (
                                <Stack direction="row" spacing={2} alignItems="center" sx={{ bgcolor: isOwn ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", p: 1, borderRadius: 1 }}>
                                  <FileText size={32} weight="duotone" />
                                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography variant="caption" noWrap sx={{ display: "block", fontWeight: 600, color: "inherit" }}>{fileName}</Typography>
                                  </Box>
                                  <IconButton size="small" component="a" href={getFileUrl(messageText)} download target="_blank" sx={{ color: "inherit" }}>
                                    <DownloadSimple size={20} />
                                  </IconButton>
                                </Stack>
                              );
                            }

                            // 4. Regular Text
                            return <Typography sx={{ fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}>{msg.message}</Typography>;
                          })()}
                        </Box>
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={isOwn ? "flex-end" : "flex-start"} sx={{ mt: 0.3, px: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">{formatTime(msg.created_at)}</Typography>
                          {isOwn && !msg._isCallEvent && (
                            Number(msg.is_read) === 1 ? (
                              <Checks size={14} weight="bold" color="#2196F3" />
                            ) : (
                              <Check size={14} weight="bold" color="text.disabled" />
                            )
                          )}
                        </Stack>
                      </Box>
                      {isOwn && <Avatar src={currentUser?.avatar} sx={{ width: 28, height: 28 }} />}
                    </Box>
                  );
                })}
                <div ref={messagesEndRef} />
              </Box>

              {/* ── 3. Contact Info Panel (Side) ───────────────────────── */}
              {showContactInfo && !isMobile && (
                <Box sx={{
                  width: 320,
                  bgcolor: "background.paper",
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column"
                }}>
                  <Box p={2} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="subtitle1" fontWeight={700}>Contact Info</Typography>
                    <IconButton onClick={() => setShowContactInfo(false)} size="small">
                      <X size={20} />
                    </IconButton>
                  </Box>
                  <Divider />
                  <Box p={3} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <Avatar src={activeContact.avatar} sx={{ width: 120, height: 120, mb: 1 }} />
                    <Box textAlign="center">
                      <Typography variant="h6" fontWeight={700}>{activeContact.username}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {Number(activeContact.is_online) === 1 ? "Online" : formatLastSeen(activeContact.last_seen)}
                      </Typography>
                    </Box>
                  </Box>
                  <Divider />
                  <Box p={2}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700, mb: 1, display: "block" }}>About / Bio</Typography>
                    <Typography variant="body2">{activeContact.bio || "No bio available"}</Typography>
                  </Box>
                  <Divider />
                  <Box p={2}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700, mb: 1, display: "block" }}>Media, Links & Docs</Typography>
                    <Typography variant="body2" color="text.disabled">None shared recently</Typography>
                  </Box>
                </Box>
              )}
            </Stack>

            <Box sx={{ p: 2, pb: isMobile ? 8 : 2, bgcolor: "background.default", borderTop: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {!isMobile && (
                  <Tooltip title="Settings">
                    <IconButton onClick={() => navigate("/settings")} sx={{ color: "text.secondary" }}>
                      <Gear size={24} weight="bold" />
                    </IconButton>
                  </Tooltip>
                )}

                <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", bgcolor: "background.paper", p: "6px 12px", borderRadius: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", position: "relative", border: "1px solid", borderColor: "divider" }}>
                  <Box sx={{ position: "absolute", bottom: "100%", right: 0, mb: 1, display: showEmojiPicker ? "block" : "none", zIndex: 10 }}>
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      theme={isDark ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                      lazyLoadEmojis={true}
                    />
                  </Box>

                  <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
                  <IconButton size="small" onClick={() => fileInputRef.current?.click()} sx={{ color: "text.secondary" }}>
                    <Paperclip size={22} weight="bold" />
                  </IconButton>

                  <InputBase
                    fullWidth
                    multiline
                    maxRows={3}
                    placeholder={`Message ${activeContact.username}...`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    sx={{ ml: 1, fontSize: 14 }}
                  />

                  <IconButton size="small" onClick={() => setShowEmojiPicker(!showEmojiPicker)} sx={{ color: showEmojiPicker ? "text.primary" : "text.secondary" }}>
                    <Smiley size={22} weight="bold" />
                  </IconButton>

                </Box>

                <IconButton
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  sx={{
                    bgcolor: "text.primary", color: "background.paper",
                    width: 44, height: 44, flexShrink: 0,
                    "&:hover": { bgcolor: "text.primary", opacity: 0.9 },
                    "&.Mui-disabled": { bgcolor: "action.disabledBackground", color: "text.disabled" }
                  }}
                >
                  <PaperPlaneRight size={22} weight="fill" />
                </IconButton>
              </Stack>
            </Box>
            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
              <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
            </Snackbar>
          </Stack>
        ) : (
          !isMobile && (
            <Stack sx={{ flexGrow: 1, width: "auto" }} alignItems="center" justifyContent="center">
              <Typography variant="h6" color="text.secondary" fontWeight={600}>Search for someone to start chatting</Typography>
              <Typography variant="body2" color="text.disabled" mt={1}>Enter a username in the search bar on the left</Typography>
            </Stack>
          )
        )
      )}
    </Stack>
  );
};

export default GeneralApp;
