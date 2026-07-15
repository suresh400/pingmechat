import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box, Stack, Avatar, Typography, InputBase, IconButton,
  Divider, Tooltip, Chip, CircularProgress, Snackbar, Alert, Menu, MenuItem,
  useMediaQuery, useTheme, Dialog, DialogContent, Rating, Button
} from "@mui/material";
import {
  MagnifyingGlass, Phone, VideoCamera, Info, PaperPlaneRight, CaretLeft,
  Paperclip, Smiley, Prohibit, Trash, SignOut, X,
  PhoneIncoming, PhoneOutgoing, DotsThreeVertical, DownloadSimple, FileText, Check, Checks,
  EnvelopeSimple, User, Hourglass, Palette, ListChecks, Star,
} from "phosphor-react";
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import useSettings from "../../hooks/useSettings";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { useNavigate, useOutletContext } from "react-router-dom";
import SelfDestructCountdown from "../../components/SelfDestructCountdown";
import WhiteboardDialog from "../../components/WhiteboardDialog";
import ConvertToTaskDialog from "../../components/ConvertToTaskDialog";
import logoCustom from "../../assets/logo-custom.png";

import { API_BASE, BASE_URL } from "../../constants";

const renderMessageTextWithLinks = (text) => {
  if (!text) return "";
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#2196F3',
            textDecoration: 'underline',
            wordBreak: 'break-all',
            fontWeight: 600
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

const FeedbackFormBubble = ({ welcomeText, authFetch }) => {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [rating, setRating] = useState(5);
  const [workingWell, setWorkingWell] = useState("");
  const [needsChange, setNeedsChange] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const res = await authFetch(`${API_BASE}/feedback/status`);
        const data = await res.json();
        if (active) {
          setHasSubmitted(data.hasSubmitted);
        }
      } catch (err) {
        console.error("Error checking feedback status:", err);
      } finally {
        if (active) {
          setCheckingStatus(false);
        }
      }
    };
    checkStatus();
    return () => { active = false; };
  }, [authFetch]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE}/feedback/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, working_well: workingWell, needs_change: needsChange })
      });
      if (res.ok) {
        setHasSubmitted(true);
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingStatus) {
    return (
      <Stack spacing={1} sx={{ p: 1, alignItems: "center" }}>
        <Typography variant="body2">{welcomeText}</Typography>
        <CircularProgress size={20} />
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 320, p: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.5 }}>
        {welcomeText}
      </Typography>
      
      <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,0.15)" }} />

      {hasSubmitted ? (
        <Box sx={{ 
          textAlign: "center", 
          py: 2, 
          px: 1,
          borderRadius: 2, 
          bgcolor: "rgba(76, 175, 80, 0.1)", 
          border: "1px dashed rgba(76, 175, 80, 0.4)" 
        }}>
          <Typography variant="subtitle2" color="#4CAF50" fontWeight={700} sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            🎉 Feedback Submitted!
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            Thank you for helping us make PingMe better!
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: 2, 
            bgcolor: "rgba(0,0,0,0.05)", 
            border: "1px solid rgba(0,0,0,0.08)" 
          }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block", mb: 0.5 }}>
              RATE YOUR EXPERIENCE
            </Typography>
            <Rating 
              name="feedback-rating" 
              value={rating} 
              onChange={(event, newValue) => setRating(newValue)} 
              size="medium"
            />
          </Box>

          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block", mb: 0.5 }}>
                WHAT IS WORKING WELL?
              </Typography>
              <InputBase
                multiline
                rows={2}
                placeholder="Type here..."
                value={workingWell}
                onChange={(e) => setWorkingWell(e.target.value)}
                sx={{
                  width: "100%",
                  bgcolor: "rgba(0,0,0,0.05)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 1.5,
                  p: "8px 12px",
                  fontSize: 13,
                  color: "text.primary"
                }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block", mb: 0.5 }}>
                WHAT NEEDS TO CHANGE / IMPROVE?
              </Typography>
              <InputBase
                multiline
                rows={2}
                placeholder="Type here..."
                value={needsChange}
                onChange={(e) => setNeedsChange(e.target.value)}
                sx={{
                  width: "100%",
                  bgcolor: "rgba(0,0,0,0.05)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 1.5,
                  p: "8px 12px",
                  fontSize: 13,
                  color: "text.primary"
                }}
              />
            </Box>
          </Stack>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              cursor: submitting ? "not-allowed" : "pointer",
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#2196F3",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "opacity 0.2s",
              opacity: submitting ? 0.6 : 1
            }}
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </Stack>
      )}
    </Stack>
  );
};

const GeneralApp = () => {
  const { currentUser, authFetch, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  const { themeMode, customChatBgColor } = useSettings();
  const theme = useTheme();
  const isDark = themeMode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [monetization, setMonetization] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/settings/monetization`)
      .then(res => res.json())
      .then(data => setMonetization(data))
      .catch(err => console.error("Error loading monetization settings:", err));
  }, []);

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
  const [timerMenuAnchor, setTimerMenuAnchor] = useState(null);
  const [selfDestructSeconds, setSelfDestructSeconds] = useState(0);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskMessageText, setTaskMessageText] = useState("");

  const messagesEndRef = useRef(null);
  const [blockedUsers, setBlockedUsers] = useState(new Set());
  const [showContactInfo, setShowContactInfo] = useState(false);

  // Conversations Persistence
  const [activeConversations, setActiveConversations] = useState(() => {
    try {
      const cached = localStorage.getItem("pingme_cached_conversations");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [conversationsLoading, setConversationsLoading] = useState(false);

  // ── Get global call state from DashboardLayout via Outlet context ──────────
  const outletCtx = useOutletContext() || {};
  const { setCallState, fetchTotalUnread } = outletCtx;

  const [mediaStream, setMediaStream] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const [contactProfile, setContactProfile] = useState(null); // full profile from API
  const [avatarOpen, setAvatarOpen] = useState(false);       // lightbox state

  const fileInputRef = useRef(null);

  const fetchActiveConversations = useCallback(async () => {
    const hasCached = !!localStorage.getItem("pingme_cached_conversations");
    if (!hasCached) {
      setConversationsLoading(true);
    }
    try {
      const res = await authFetch(`${API_BASE}/contacts/active`);
      const data = await res.json();
      const conversations = Array.isArray(data) ? data : [];
      setActiveConversations(conversations);
      localStorage.setItem("pingme_cached_conversations", JSON.stringify(conversations));
    } catch (err) {
      console.error("[fetchActiveConversations] Error:", err);
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

  // Fetch full contact profile when info panel opens
  useEffect(() => {
    if (showContactInfo && activeContact?.id) {
      setContactProfile(null); // reset while loading
      authFetch(`${API_BASE}/users/${activeContact.id}/profile`)
        .then(r => r.json())
        .then(data => setContactProfile(data))
        .catch(() => setContactProfile(null));
    } else if (!showContactInfo) {
      setContactProfile(null);
    }
  }, [showContactInfo, activeContact?.id, authFetch]);

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
    const hasCached = !!localStorage.getItem(`pingme_cached_msgs_${contactId}`);
    if (!hasCached) {
      setMessagesLoading(true);
    }
    try {
      const res = await authFetch(`${API_BASE}/messages/${contactId}`);
      const data = await res.json();
      const msgs = Array.isArray(data) ? data : [];
      setMessages(msgs);
      localStorage.setItem(`pingme_cached_msgs_${contactId}`, JSON.stringify(msgs));
      fetchActiveConversations();
      if (fetchTotalUnread) fetchTotalUnread();
    } catch {
      // Keep cached if network fails
    }
    finally { setMessagesLoading(false); }
  }, [authFetch, fetchActiveConversations, fetchTotalUnread]);

  // Load cached messages instantly when contact changes, then update from network
  useEffect(() => {
    if (activeContact) {
      try {
        const cached = localStorage.getItem(`pingme_cached_msgs_${activeContact.id}`);
        if (cached) {
          setMessages(JSON.parse(cached));
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
      fetchMessages(activeContact.id);
    }
  }, [activeContact, fetchMessages]);

  // Sync state changes back to cache in real time
  useEffect(() => {
    if (activeContact?.id && messages.length > 0) {
      try {
        localStorage.setItem(`pingme_cached_msgs_${activeContact.id}`, JSON.stringify(messages));
      } catch (e) {
        console.error(e);
      }
    }
  }, [messages, activeContact?.id]);

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

    const deleteHandler = (data) => {
      const { messageId } = data;
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
    };

    socket.on("receive_message", handler);
    socket.on("message_read", readHandler);
    socket.on("message_deleted", deleteHandler);

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
      socket.off("message_deleted", deleteHandler);
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
      self_destruct_seconds: selfDestructSeconds,
    });
    setNewMessage("");
    setShowEmojiPicker(false);
    setSelfDestructSeconds(0);
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
        self_destruct_seconds: selfDestructSeconds,
      });
      setSelfDestructSeconds(0);
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

  const handleLogout = () => { stopMedia(); logout(); navigate("/"); };
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
            <Box sx={{ display: "flex", alignItems: "center", bgcolor: "action.hover", borderRadius: 2, p: "6px 12px", gap: 1.2 }}>
              <img src={logoCustom} alt="PingMe" style={{ width: 22, height: 22, borderRadius: "4px", objectFit: "contain" }} />
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
          {monetization?.monetization_enabled && (
            <Box sx={{ p: 2, m: 1.5, borderRadius: 2, bgcolor: isDark ? "rgba(255, 215, 0, 0.08)" : "#FFFDE7", border: "1px solid", borderColor: isDark ? "rgba(255, 215, 0, 0.3)" : "#FFF59D", display: "flex", flexDirection: "column", gap: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Star size={16} color="#FFD700" weight="fill" />
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: isDark ? "#FFD700" : "#F57F17", fontSize: 12 }}>PingMe Premium</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Get ad-free experience & unlimited features for just ${monetization?.premium_price}/mo.</Typography>
              <Button size="small" variant="contained" sx={{ bgcolor: isDark ? "#FFD700" : "#F57F17", color: "#000", fontWeight: 700, fontSize: 10, py: 0.5, "&:hover": { bgcolor: isDark ? "#FFC700" : "#E65100" } }} onClick={() => setUpgradeOpen(true)}>Upgrade Now</Button>
            </Box>
          )}
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
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  onClick={() => setShowContactInfo(true)}
                  sx={{ cursor: "pointer" }}
                >
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
                </Stack>
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
                <Tooltip title="Collaborative Whiteboard">
                  <IconButton
                    onClick={() => setWhiteboardOpen(true)}
                    sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
                  >
                    <Palette size={22} weight="bold" />
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
                bgcolor: customChatBgColor || (isDark ? "#0b141a" : "#e5ddd5"),
                backgroundImage: customChatBgColor
                  ? "none"
                  : (isDark
                      ? "linear-gradient(rgba(11, 20, 26, 0.93), rgba(11, 20, 26, 0.93)), url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')"
                      : "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')"),
                backgroundRepeat: "repeat",
                position: "relative"
              }}>
                {messagesLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress size={24} sx={{ color: "text.primary" }} /></Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ textAlign: "center", mt: 8 }}>
                    <Typography variant="body2" color="text.secondary">No messages yet — say hi! 👋</Typography>
                  </Box>
                ) : (() => {
                  let lastDateStr = null;
                  return messages.map((msg) => {
                    const isOwn = Number(msg.sender_id) === Number(currentUser?.id);

                    // Day-wise grouping calculation
                    const msgDate = new Date(msg.created_at || Date.now());
                    const dateStr = msgDate.toDateString();
                    const showDateSeparator = dateStr !== lastDateStr;
                    lastDateStr = dateStr;

                    const dateSeparatorText = (() => {
                      const today = new Date();
                      const yesterday = new Date();
                      yesterday.setDate(today.getDate() - 1);
                      if (dateStr === today.toDateString()) return "TODAY";
                      if (dateStr === yesterday.toDateString()) return "YESTERDAY";
                      return msgDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                    })();

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateSeparator && (
                          <Box sx={{ display: "flex", justifyContent: "center", my: 2, width: "100%" }}>
                            <Box sx={{
                              bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                              border: "1px solid",
                              borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                              borderRadius: "12px",
                              px: 2,
                              py: 0.5,
                              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                              zIndex: 1,
                            }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", letterSpacing: 0.5 }}>
                                {dateSeparatorText}
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* ── Call event bubble ──────────────────────────────────────────── */}
                        {msg._isCallEvent ? (
                          (() => {
                            const isAccepted = msg._callStatus === "accepted";
                            return (
                              <Box sx={{ display: "flex", justifyContent: "center", my: 0.5 }}>
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
                          })()
                        ) : (
                          <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: isOwn ? "flex-end" : "flex-start", gap: 1 }}>
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
                                  const isUpload = messageText.includes("/uploads") || messageText.includes("\\uploads") || messageText.includes("cloudinary.com");
                                  const isImage = messageText.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i);
                                  const isVideo = messageText.match(/\.(webm|mp4|ogg)(\?.*)?$/i);

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

                                  // 4. Feedback Form Check
                                  if (messageText.includes("[FEEDBACK_FORM]")) {
                                    const cleanWelcome = msg.message.replace("[FEEDBACK_FORM]", "").trim();
                                    return <FeedbackFormBubble welcomeText={cleanWelcome} authFetch={authFetch} />;
                                  }

                                  // 5. Regular Text (with clickable links parsed)
                                  return (
                                    <Typography sx={{ fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}>
                                      {renderMessageTextWithLinks(msg.message)}
                                    </Typography>
                                  );
                                })()}
                              </Box>
                              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={isOwn ? "flex-end" : "flex-start"} sx={{ mt: 0.3, px: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">{formatTime(msg.created_at)}</Typography>
                                {msg.self_destruct_seconds > 0 && (
                                  <SelfDestructCountdown
                                    messageId={msg.id}
                                    seconds={msg.self_destruct_seconds}
                                    createdAt={msg.created_at}
                                    isGroup={false}
                                    chatId={activeContact.id}
                                    authFetch={authFetch}
                                    onDeleteLocal={(id) => setMessages((prev) => prev.filter((m) => String(m.id) !== String(id)))}
                                  />
                                )}
                                {!msg._isCallEvent && (
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
                                )}
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
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
                <div ref={messagesEndRef} />
              </Box>

              {/* ── 3. Contact Info Panel (Side) ───────────────────────── */}
              {showContactInfo && !isMobile && (
                <Box sx={{
                  width: 300,
                  bgcolor: "background.paper",
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto"
                }}>
                  {/* Header */}
                  <Box p={2} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="subtitle1" fontWeight={700}>Contact Info</Typography>
                    <IconButton onClick={() => setShowContactInfo(false)} size="small">
                      <X size={20} />
                    </IconButton>
                  </Box>
                  <Divider />

                  {/* Avatar + Name */}
                  <Box p={3} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                    <Box
                      onClick={() => setAvatarOpen(true)}
                      sx={{
                        cursor: "pointer",
                        borderRadius: "50%",
                        border: "3px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        "&:hover": { transform: "scale(1.05)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }
                      }}
                    >
                      <Avatar
                        src={contactProfile?.avatar || activeContact.avatar}
                        sx={{ width: 110, height: 110 }}
                      />
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: -0.5 }}>
                        {activeContact.username}
                      </Typography>
                      <Typography variant="caption" sx={{ color: Number(activeContact.is_online) === 1 ? "#4CAF50" : "text.secondary", fontWeight: 600 }}>
                        {Number(activeContact.is_online) === 1 ? "● Online" : formatLastSeen(activeContact.last_seen)}
                      </Typography>
                    </Box>
                  </Box>
                  <Divider />

                  {/* Details */}
                  <Box p={2.5} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {/* Username row */}
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Box sx={{ color: "text.secondary", flexShrink: 0 }}><User size={18} /></Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.8 }}>Username</Typography>
                        <Typography variant="body2" fontWeight={600}>{activeContact.username}</Typography>
                      </Box>
                    </Stack>

                    {/* Email/Phone row — only if contact allows it */}
                    {contactProfile === null ? (
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ color: "text.secondary", flexShrink: 0 }}><EnvelopeSimple size={18} /></Box>
                        <CircularProgress size={14} />
                      </Stack>
                    ) : contactProfile?.email ? (
                      (() => {
                        const isPhone = contactProfile.email.endsWith("@phone.supabase");
                        const label = isPhone ? "Phone Number" : "Email";
                        const displayVal = isPhone ? contactProfile.email.replace("@phone.supabase", "") : contactProfile.email;
                        return (
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box sx={{ color: "text.secondary", flexShrink: 0 }}>
                              {isPhone ? <Phone size={18} /> : <EnvelopeSimple size={18} />}
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.8 }}>{label}</Typography>
                              <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-all" }}>{displayVal}</Typography>
                            </Box>
                          </Stack>
                        );
                      })()
                    ) : (
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ color: "text.secondary", flexShrink: 0 }}>
                          {activeContact.username.startsWith("+") ? <Phone size={18} /> : <EnvelopeSimple size={18} />}
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.8 }}>
                            {activeContact.username.startsWith("+") ? "Phone Number" : "Email"}
                          </Typography>
                          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>Hidden by user</Typography>
                        </Box>
                      </Stack>
                    )}
                  </Box>
                  <Divider />

                  {/* Bio */}
                  <Box p={2.5}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700, mb: 0.8, display: "block", fontSize: 10, letterSpacing: 0.8 }}>About / Bio</Typography>
                    <Typography variant="body2" sx={{ lineHeight: 1.6, color: contactProfile?.bio ? "text.primary" : "text.disabled", fontStyle: contactProfile?.bio ? "normal" : "italic" }}>
                      {contactProfile?.bio || (contactProfile === null ? "" : "No bio set")}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Avatar Lightbox */}
              <Dialog
                open={avatarOpen}
                onClose={() => setAvatarOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                  sx: {
                    bgcolor: "transparent",
                    boxShadow: "none",
                    borderRadius: "50%",
                    overflow: "hidden",
                    m: 2
                  }
                }}
                sx={{ "& .MuiBackdrop-root": { bgcolor: "rgba(0,0,0,0.85)" } }}
              >
                <DialogContent sx={{ p: 0, borderRadius: "50%", overflow: "hidden" }}>
                  <Avatar
                    src={contactProfile?.avatar || activeContact?.avatar}
                    sx={{
                      width: "100%",
                      height: "auto",
                      aspectRatio: "1",
                      borderRadius: "50%",
                      display: "block"
                    }}
                  />
                </DialogContent>
              </Dialog>

              {/* Mobile Contact Info Dialog */}
              {showContactInfo && isMobile && (
                <Dialog
                  open={showContactInfo}
                  onClose={() => setShowContactInfo(false)}
                  fullWidth
                  maxWidth="xs"
                  PaperProps={{
                    sx: {
                      bgcolor: "background.paper",
                      borderRadius: 4,
                      p: 1
                    }
                  }}
                  sx={{ "& .MuiBackdrop-root": { bgcolor: "rgba(0,0,0,0.5)" } }}
                >
                  <Box p={2} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="subtitle1" fontWeight={700}>Contact Info</Typography>
                    <IconButton onClick={() => setShowContactInfo(false)} size="small">
                      <X size={20} />
                    </IconButton>
                  </Box>
                  <Divider />

                  {/* Avatar + Name */}
                  <Box p={3} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                    <Box
                      onClick={() => setAvatarOpen(true)}
                      sx={{
                        cursor: "pointer",
                        borderRadius: "50%",
                        border: "3px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        "&:hover": { transform: "scale(1.05)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }
                      }}
                    >
                      <Avatar
                        src={contactProfile?.avatar || activeContact.avatar}
                        sx={{ width: 110, height: 110 }}
                      />
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: -0.5 }}>
                        {activeContact.username}
                      </Typography>
                      <Typography variant="caption" sx={{ color: Number(activeContact.is_online) === 1 ? "#4CAF50" : "text.secondary", fontWeight: 600 }}>
                        {Number(activeContact.is_online) === 1 ? "● Online" : formatLastSeen(activeContact.last_seen)}
                      </Typography>
                    </Box>
                  </Box>
                  <Divider />

                  {/* Details */}
                  <Box p={2.5} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {/* Username row */}
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Box sx={{ color: "text.secondary", flexShrink: 0 }}><User size={18} /></Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.8 }}>Username</Typography>
                        <Typography variant="body2" fontWeight={600}>{activeContact.username}</Typography>
                      </Box>
                    </Stack>

                    {/* Email/Phone row — only if contact allows it */}
                    {contactProfile === null ? (
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ color: "text.secondary", flexShrink: 0 }}><EnvelopeSimple size={18} /></Box>
                        <CircularProgress size={14} />
                      </Stack>
                    ) : contactProfile?.email ? (
                      (() => {
                        const isPhone = contactProfile.email.endsWith("@phone.supabase");
                        const label = isPhone ? "Phone Number" : "Email";
                        const displayVal = isPhone ? contactProfile.email.replace("@phone.supabase", "") : contactProfile.email;
                        return (
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box sx={{ color: "text.secondary", flexShrink: 0 }}>
                              {isPhone ? <Phone size={18} /> : <EnvelopeSimple size={18} />}
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.8 }}>{label}</Typography>
                              <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-all" }}>{displayVal}</Typography>
                            </Box>
                          </Stack>
                        );
                      })()
                    ) : (
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ color: "text.secondary", flexShrink: 0 }}>
                          {activeContact.username.startsWith("+") ? <Phone size={18} /> : <EnvelopeSimple size={18} />}
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.8 }}>
                            {activeContact.username.startsWith("+") ? "Phone Number" : "Email"}
                          </Typography>
                          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>Hidden by user</Typography>
                        </Box>
                      </Stack>
                    )}
                  </Box>
                  <Divider />

                  {/* Bio */}
                  <Box p={2.5}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700, mb: 0.8, display: "block", fontSize: 10, letterSpacing: 0.8 }}>About / Bio</Typography>
                    <Typography variant="body2" sx={{ lineHeight: 1.6, color: contactProfile?.bio ? "text.primary" : "text.disabled", fontStyle: contactProfile?.bio ? "normal" : "italic" }}>
                      {contactProfile?.bio || (contactProfile === null ? "" : "No bio set")}
                    </Typography>
                  </Box>
                </Dialog>
              )}
            </Stack>

            <Box sx={{ p: 2, pb: isMobile ? 8 : 2, bgcolor: "background.default", borderTop: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" spacing={1.5} alignItems="center">


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

            {whiteboardOpen && (
              <WhiteboardDialog
                open={whiteboardOpen}
                onClose={() => setWhiteboardOpen(false)}
                socket={socket}
                chatId={activeContact.id}
                isGroup={false}
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
        ) : (
          !isMobile && (
            <Stack sx={{ flexGrow: 1, width: "auto" }} alignItems="center" justifyContent="center">
              <Typography variant="h6" color="text.secondary" fontWeight={600}>Search for someone to start chatting</Typography>
              <Typography variant="body2" color="text.disabled" mt={1}>Enter a username in the search bar on the left</Typography>
            </Stack>
          )
        )
      )}
      <Dialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} maxWidth="xs" fullWidth>
        <Box p={3} textAlign="center" sx={{ bgcolor: isDark ? "background.paper" : "#fff" }}>
          <Typography variant="h6" fontWeight={800} mb={1}>Upgrade to PingMe Premium</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>Enjoy an ad-free experience, unlimited VoIP calls, custom whiteboard themes, and priority support.</Typography>
          <Box p={2} mb={3} borderRadius={2} bgcolor="action.hover" border="1px dashed" borderColor="divider">
            <Typography variant="h4" fontWeight={800} color="primary.main">${monetization?.premium_price || "4.99"}</Typography>
            <Typography variant="caption" color="text.secondary">per month</Typography>
          </Box>
          <Button fullWidth variant="contained" sx={{ bgcolor: "text.primary", color: "background.paper", "&:hover": { bgcolor: "text.primary", opacity: 0.9 } }} onClick={() => { setUpgradeOpen(false); setSnackbar({ open: true, message: "Thank you for upgrading to Premium!", severity: "success" }); }}>Proceed to Payment</Button>
        </Box>
      </Dialog>
    </Stack>
  );
};

export default GeneralApp;
