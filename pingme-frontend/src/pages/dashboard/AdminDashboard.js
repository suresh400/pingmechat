import React, { useState, useEffect } from "react";
import {
  Box, Stack, Typography, TextField, Button, Paper, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, CircularProgress, Alert, Snackbar, Grid, Card, CardContent, Divider
} from "@mui/material";
import {
  Trash, ChartBar, Users, ChatCircleDots, ShieldCheck,
  Star, SignOut, Megaphone, Coins, Warning
} from "phosphor-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../constants";

const AdminDashboard = () => {
  const { currentUser, login, logout, authFetch } = useAuth();
  const navigate = useNavigate();

  // Login states
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Tab state: 0 = Users, 1 = Feedback & Suggestions, 2 = Reports, 3 = Broadcast, 4 = Monetization
  const [activeTab, setActiveTab] = useState(0);

  // Data states
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [reports, setReports] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [monetization, setMonetization] = useState({
    monetization_enabled: false,
    premium_price: "4.99",
    ad_unit_id: "ca-pub-123456789"
  });

  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  // Broadcast States
  const [broadcastTarget, setBroadcastTarget] = useState("all");
  const [broadcastUsername, setBroadcastUsername] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Delete User Dialog
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const isAdmin = currentUser && currentUser.email === "admin@pingme.chat";

  // Fetch admin dashboard details
  const fetchDashboardData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      // Fetch stats
      const statsRes = await authFetch(`${API_BASE}/admin/stats`);
      if (statsRes.ok) setStats(await statsRes.json());

      // Fetch users
      const usersRes = await authFetch(`${API_BASE}/admin/users`);
      if (usersRes.ok) setUsers(await usersRes.json());

      // Fetch feedbacks
      const feedbacksRes = await authFetch(`${API_BASE}/admin/feedbacks`);
      if (feedbacksRes.ok) setFeedbacks(await feedbacksRes.json());

      // Fetch reports
      const reportsRes = await authFetch(`${API_BASE}/admin/reports`);
      if (reportsRes.ok) setReports(await reportsRes.json());

      // Fetch suggestions
      const suggestionsRes = await authFetch(`${API_BASE}/admin/suggestions`);
      if (suggestionsRes.ok) setSuggestions(await suggestionsRes.json());

      // Fetch settings
      const settingsRes = await authFetch(`${API_BASE}/admin/settings`);
      if (settingsRes.ok) setMonetization(await settingsRes.json());

    } catch (err) {
      console.error("[AdminDashboard] Error fetching data:", err);
      setSnackbar({ open: true, message: "Error fetching admin dashboard data.", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDismissReport = async (reportId) => {
    try {
      const res = await authFetch(`${API_BASE}/admin/reports/${reportId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSnackbar({ open: true, message: "Report dismissed successfully. ✓", severity: "success" });
        fetchDashboardData();
      } else {
        throw new Error("Failed to dismiss report.");
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: "error" });
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      setSnackbar({ open: true, message: "Please type a message to send.", severity: "error" });
      return;
    }
    if (broadcastTarget === "single" && !broadcastUsername.trim()) {
      setSnackbar({ open: true, message: "Please enter a username.", severity: "error" });
      return;
    }
    setSendingBroadcast(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: broadcastTarget,
          username: broadcastTarget === "single" ? broadcastUsername.trim() : undefined,
          message: broadcastMessage.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSnackbar({ open: true, message: data.message || "Announcement sent successfully! ✓", severity: "success" });
      setBroadcastMessage("");
      setBroadcastUsername("");
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: "error" });
    } finally {
      setSendingBroadcast(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Handle admin authentication
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      if (emailInput.trim() !== "admin@pingme.chat") {
        throw new Error("Invalid admin credentials.");
      }
      await login(emailInput, passwordInput);
      setSnackbar({ open: true, message: "Welcome back, Admin!", severity: "success" });
    } catch (err) {
      setLoginError(err.message || "Failed to log in as admin.");
    } finally {
      setLoggingIn(false);
    }
  };

  // Handle user delete complete
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${userToDelete.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSnackbar({ open: true, message: "User deleted completely from system.", severity: "success" });
        setDeleteUserOpen(false);
        setUserToDelete(null);
        fetchDashboardData();
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to delete user.");
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: "error" });
    } finally {
      setDeletingUser(false);
    }
  };

  // Save monetization configurations
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(monetization)
      });
      if (res.ok) {
        setSnackbar({ open: true, message: "Settings saved successfully.", severity: "success" });
      } else {
        throw new Error("Failed to save monetization settings.");
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: "error" });
    } finally {
      setSavingSettings(false);
    }
  };

  // Login Screen layout
  if (!isAdmin) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#121212", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
        <Paper elevation={24} sx={{ p: 4, width: "100%", maxWidth: 400, bgcolor: "#1e1e1e", borderRadius: 4, border: "1px solid #333" }}>
          <Stack spacing={3} alignItems="center">
            <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,0.05)", borderRadius: "50%" }}>
              <ShieldCheck size={48} color="#FF5252" weight="duotone" />
            </Box>
            <Box textAlign="center">
              <Typography variant="h5" fontWeight={800}>Admin Control Center</Typography>
              <Typography variant="caption" color="text.secondary">Secure Login for Authorized Admins Only</Typography>
            </Box>

            {loginError && (
              <Alert severity="error" sx={{ width: "100%", bgcolor: "rgba(211,47,47,0.1)", color: "#FF5252" }}>
                {loginError}
              </Alert>
            )}

            <form onSubmit={handleLogin} style={{ width: "100%" }}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  variant="outlined"
                  label="Admin Email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  InputProps={{ style: { color: "#fff" } }}
                  InputLabelProps={{ style: { color: "#888" } }}
                  sx={{ "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#333" }, "&:hover fieldset": { borderColor: "#555" } } }}
                />
                <TextField
                  fullWidth
                  variant="outlined"
                  label="Password"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  InputProps={{ style: { color: "#fff" } }}
                  InputLabelProps={{ style: { color: "#888" } }}
                  sx={{ "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#333" }, "&:hover fieldset": { borderColor: "#555" } } }}
                />
                <Button
                  fullWidth
                  size="large"
                  type="submit"
                  variant="contained"
                  disabled={loggingIn}
                  sx={{ bgcolor: "#fff", color: "#000", fontWeight: 700, "&:hover": { bgcolor: "#eee" } }}
                >
                  {loggingIn ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
                </Button>
              </Stack>
            </form>
            <Button size="small" variant="text" sx={{ color: "#888" }} onClick={() => navigate("/")}>
              Back to Chat
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  // Dashboard layout
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#121212", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Box sx={{ borderBottom: "1px solid #222", bgcolor: "#1a1a1a", px: 4, py: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ShieldCheck size={28} color="#FFD700" weight="fill" />
            <Typography variant="h6" fontWeight={800} letterSpacing={0.5}>PINGME ADMIN</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="body2" color="text.secondary">Logged in as <strong>{currentUser?.username}</strong></Typography>
            <IconButton onClick={() => { logout(); navigate("/admin"); }} sx={{ color: "#FF5252" }}>
              <SignOut size={20} weight="bold" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, p: 4, maxWidth: 1200, width: "100%", mx: "auto" }}>
        {/* Stats Cards */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>TOTAL USERS</Typography>
                    <Typography variant="h4" fontWeight={800} mt={0.5}>{stats ? stats.usersCount : "..."}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: "rgba(33,150,243,0.1)", borderRadius: 3 }}>
                    <Users size={24} color="#2196F3" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>MESSAGE TRAFFIC</Typography>
                    <Typography variant="h4" fontWeight={800} mt={0.5}>{stats ? stats.messagesCount : "..."}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: "rgba(76,175,80,0.1)", borderRadius: 3 }}>
                    <ChatCircleDots size={24} color="#4CAF50" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>GROUP CHATS</Typography>
                    <Typography variant="h4" fontWeight={800} mt={0.5}>{stats ? stats.groupsCount : "..."}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: "rgba(156,39,176,0.1)", borderRadius: 3 }}>
                    <ChartBar size={24} color="#9C27B0" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>FEEDBACKS RECEIVED</Typography>
                    <Typography variant="h4" fontWeight={800} mt={0.5}>{stats ? stats.feedbacksCount : "..."}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: "rgba(255,152,0,0.1)", borderRadius: 3 }}>
                    <Megaphone size={24} color="#FF9800" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tab Headers */}
        <Paper sx={{ bgcolor: "#1a1a1a", border: "1px solid #222", borderRadius: 3, mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            textColor="inherit"
            indicatorColor="primary"
            sx={{
              "& .MuiTabs-indicator": { bgcolor: "#fff" },
              "& .MuiTab-root": { fontWeight: 700, py: 2 }
            }}
          >
            <Tab label="Users Management" icon={<Users size={18} />} iconPosition="start" />
            <Tab label="Feedbacks & Suggestions" icon={<Megaphone size={18} />} iconPosition="start" />
            <Tab label="User Reports" icon={<Warning size={18} />} iconPosition="start" />
            <Tab label="Broadcast Updates" icon={<ChatCircleDots size={18} />} iconPosition="start" />
            <Tab label="Monetization Center" icon={<Coins size={18} />} iconPosition="start" />
          </Tabs>
        </Paper>

        {/* Loading Spinner */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress color="inherit" />
          </Box>
        ) : (
          <Box>
            {/* Tab 0: Users Management */}
            {activeTab === 0 && (
              <TableContainer component={Paper} sx={{ bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead sx={{ bgcolor: "#151515" }}>
                    <TableRow>
                      <TableCell sx={{ color: "#888", fontWeight: 700 }}>Avatar</TableCell>
                      <TableCell sx={{ color: "#888", fontWeight: 700 }}>Username</TableCell>
                      <TableCell sx={{ color: "#888", fontWeight: 700 }}>Email/Phone</TableCell>
                      <TableCell sx={{ color: "#888", fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ color: "#888", fontWeight: 700 }}>Join Date</TableCell>
                      <TableCell align="right" sx={{ color: "#888", fontWeight: 700 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u) => {
                      const isPhone = u.email?.endsWith("@phone.supabase");
                      const displayContact = isPhone ? u.email.replace("@phone.supabase", "") : u.email;
                      const isTargetAdmin = u.email === "admin@pingme.chat";

                      return (
                        <TableRow key={u.id} sx={{ "&:last-child td, &:last-child th": { border: 0 }, "&:hover": { bgcolor: "rgba(255,255,255,0.01)" } }}>
                          <TableCell>
                            <Avatar src={u.avatar} sx={{ width: 36, height: 36 }} />
                          </TableCell>
                          <TableCell sx={{ color: "#fff", fontWeight: 600 }}>{u.username}</TableCell>
                          <TableCell sx={{ color: "#aaa" }}>
                            {displayContact}
                            {isPhone && <Typography variant="caption" display="block" color="primary.main">Supabase Phone</Typography>}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: u.is_online ? "#4CAF50" : "#888", fontWeight: 600 }}>
                              {u.is_online ? "Online" : "Offline"}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: "#888" }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "..."}</TableCell>
                          <TableCell align="right">
                            {!isTargetAdmin && (
                              <IconButton
                                onClick={() => { setUserToDelete(u); setDeleteUserOpen(true); }}
                                sx={{ color: "#FF5252", "&:hover": { bgcolor: "rgba(255,82,82,0.1)" } }}
                              >
                                <Trash size={18} />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Tab 1: Feedback & Suggestions Logs */}
            {activeTab === 1 && (
              <Stack spacing={4}>
                {/* Standalone Feature Suggestions / Ideas */}
                <Box>
                  <Typography variant="h6" fontWeight={800} mb={2}>User Feature Suggestions & Ideas</Typography>
                  {suggestions.length === 0 ? (
                    <Paper sx={{ p: 3, bgcolor: "#1e1e1e", border: "1px solid #222", textAlign: "center", borderRadius: 3 }}>
                      <Typography color="text.secondary">No feature suggestions submitted yet.</Typography>
                    </Paper>
                  ) : (
                    <Grid container spacing={2}>
                      {suggestions.map((s) => (
                        <Grid item xs={12} key={s.id}>
                          <Paper sx={{ p: 3, bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                              <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Avatar src={s.avatar} sx={{ width: 32, height: 32 }} />
                                <Box>
                                  <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>{s.username}</Typography>
                                  <Typography variant="caption" color="text.secondary">User ID: {s.user_id}</Typography>
                                </Box>
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "..."}
                              </Typography>
                            </Stack>
                            <Box sx={{ bgcolor: "#151515", p: 2, borderRadius: 2, border: "1px solid #222" }}>
                              <Typography variant="body2" sx={{ color: "#fff", whiteSpace: "pre-wrap" }}>
                                {s.suggestion}
                              </Typography>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>

                <Divider sx={{ borderColor: "#222" }} />

                {/* Rating Feedbacks */}
                <Box>
                  <Typography variant="h6" fontWeight={800} mb={2}>General Feedback & Ratings</Typography>
                  {feedbacks.length === 0 ? (
                    <Paper sx={{ p: 3, bgcolor: "#1e1e1e", border: "1px solid #222", textAlign: "center", borderRadius: 3 }}>
                      <Typography color="text.secondary">No rating feedback submissions yet.</Typography>
                    </Paper>
                  ) : (
                    <Stack spacing={3}>
                      {feedbacks.map((f) => (
                        <Paper key={f.id} sx={{ p: 3, bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
                          <Stack spacing={2}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Avatar src={f.avatar} sx={{ width: 32, height: 32 }} />
                                <Box>
                                  <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>{f.username}</Typography>
                                  <Typography variant="caption" color="text.secondary">User ID: {f.user_id}</Typography>
                                </Box>
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {f.submitted_at ? new Date(f.submitted_at).toLocaleString() : "..."}
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={0.5} alignItems="center">
                              {[...Array(5)].map((_, idx) => (
                                <Star
                                  key={idx}
                                  size={16}
                                  weight={idx < f.rating ? "fill" : "regular"}
                                  color="#FFD700"
                                />
                              ))}
                              <Typography variant="body2" fontWeight={700} ml={1} sx={{ color: "#fff" }}>{f.rating}/5 Rating</Typography>
                            </Stack>

                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ textTransform: "uppercase" }}>What's Working Well</Typography>
                                <Typography variant="body2" mt={0.5} sx={{ color: "#fff", bgcolor: "#151515", p: 1.5, borderRadius: 2, border: "1px solid #222" }}>
                                  {f.working_well || "N/A"}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="error.main" fontWeight={700} sx={{ textTransform: "uppercase" }}>What Needs to Change</Typography>
                                <Typography variant="body2" mt={0.5} sx={{ color: "#fff", bgcolor: "#151515", p: 1.5, borderRadius: 2, border: "1px solid #222" }}>
                                  {f.needs_change || "N/A"}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Box>
              </Stack>
            )}

            {/* Tab 2: User Reports */}
            {activeTab === 2 && (
              <Stack spacing={3}>
                {reports.length === 0 ? (
                  <Paper sx={{ p: 4, bgcolor: "#1e1e1e", border: "1px solid #222", textAlign: "center", borderRadius: 3 }}>
                    <Typography color="text.secondary">No user reports submitted yet. Everything is quiet!</Typography>
                  </Paper>
                ) : (
                  <TableContainer component={Paper} sx={{ bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
                    <Table sx={{ minWidth: 650 }}>
                      <TableHead sx={{ bgcolor: "#151515" }}>
                        <TableRow>
                          <TableCell sx={{ color: "#888", fontWeight: 700 }}>Reported User</TableCell>
                          <TableCell sx={{ color: "#888", fontWeight: 700 }}>Reporter</TableCell>
                          <TableCell sx={{ color: "#888", fontWeight: 700 }}>Reason / Details</TableCell>
                          <TableCell sx={{ color: "#888", fontWeight: 700 }}>Date</TableCell>
                          <TableCell align="right" sx={{ color: "#888", fontWeight: 700 }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reports.map((r) => (
                          <TableRow key={r.id} sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                            <TableCell>
                              <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Avatar src={r.reported_avatar} sx={{ width: 32, height: 32 }} />
                                <Box>
                                  <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>
                                    {r.reported_username}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {r.reported_email} (ID: {r.reported_id})
                                  </Typography>
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ color: "#fff" }}>
                              {r.reporter_username} (ID: {r.reporter_id})
                            </TableCell>
                            <TableCell sx={{ color: "#f44336", fontWeight: 500 }}>
                              {r.reason}
                            </TableCell>
                            <TableCell sx={{ color: "#aaa" }}>
                              {new Date(r.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => handleDismissReport(r.id)}
                                  sx={{
                                    borderColor: "#4CAF50",
                                    color: "#4CAF50",
                                    textTransform: "none",
                                    "&:hover": { borderColor: "#45a049", bgcolor: "rgba(76,175,80,0.05)" }
                                  }}
                                >
                                  Dismiss
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={() => {
                                    setUserToDelete({ id: r.reported_id, username: r.reported_username });
                                    setDeleteUserOpen(true);
                                  }}
                                  sx={{
                                    bgcolor: "#f44336",
                                    color: "#fff",
                                    textTransform: "none",
                                    "&:hover": { bgcolor: "#d32f2f" }
                                  }}
                                >
                                  Delete User
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            )}

            {/* Tab 3: Broadcast Updates & Announcements */}
            {activeTab === 3 && (
              <Paper sx={{ p: 4, bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
                <Stack spacing={4}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} mb={1}>Send System Updates & Announcements</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Send a message that will show up as a direct support message from "Admin" on the user's chat screen.
                    </Typography>
                  </Box>

                  <Stack spacing={3} sx={{ maxWidth: 600 }}>
                    <Box sx={{ border: "1px solid #333", borderRadius: 2, p: 2, bgcolor: "#151515" }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: "block", mb: 1.5 }}>
                        RECIPIENT TARGET
                      </Typography>
                      <Stack direction="row" spacing={3}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#fff", fontSize: 14 }}>
                          <input
                            type="radio"
                            name="broadcastTarget"
                            checked={broadcastTarget === "all"}
                            onChange={() => setBroadcastTarget("all")}
                            style={{ accentColor: "#fff" }}
                          />
                          Broadcast to All Users
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#fff", fontSize: 14 }}>
                          <input
                            type="radio"
                            name="broadcastTarget"
                            checked={broadcastTarget === "single"}
                            onChange={() => setBroadcastTarget("single")}
                            style={{ accentColor: "#fff" }}
                          />
                          Send to Specific User
                        </label>
                      </Stack>
                    </Box>

                    {broadcastTarget === "single" && (
                      <TextField
                        fullWidth
                        label="Target User's Username"
                        placeholder="Enter exact username..."
                        value={broadcastUsername}
                        onChange={(e) => setBroadcastUsername(e.target.value)}
                        variant="outlined"
                        InputProps={{ style: { color: "#fff" } }}
                        InputLabelProps={{ style: { color: "#888" } }}
                        sx={{ "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#333" }, "&:hover fieldset": { borderColor: "#555" } } }}
                      />
                    )}

                    <TextField
                      fullWidth
                      multiline
                      rows={5}
                      label="Announcement / Message Content"
                      placeholder="Type your announcement or update here..."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      variant="outlined"
                      InputProps={{ style: { color: "#fff" } }}
                      InputLabelProps={{ style: { color: "#888" } }}
                      sx={{ "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#333" }, "&:hover fieldset": { borderColor: "#555" } } }}
                    />

                    <Button
                      variant="contained"
                      onClick={handleSendBroadcast}
                      disabled={sendingBroadcast || !broadcastMessage.trim()}
                      sx={{ bgcolor: "#fff", color: "#000", fontWeight: 700, "&:hover": { bgcolor: "#eee" }, alignSelf: "flex-start", px: 4, py: 1.2 }}
                    >
                      {sendingBroadcast ? <CircularProgress size={20} color="inherit" /> : "Send Update"}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}

            {/* Tab 4: Monetization Center */}
            {activeTab === 4 && (
              <Paper sx={{ p: 4, bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
                <Stack spacing={4}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} mb={1}>Monetization & Ads</Typography>
                    <Typography variant="body2" color="text.secondary">Toggle app monetization features, banner ads, and define pricing tiers for premium upgrades.</Typography>
                  </Box>

                  <Stack spacing={3} sx={{ maxWidth: 500 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5, borderBottom: "1px solid #222" }}>
                      <Box>
                        <Typography fontWeight={600}>Enable App Monetization</Typography>
                        <Typography variant="caption" color="text.secondary">Shows the premium promotion banner and restricts select elements.</Typography>
                      </Box>
                      <Switch
                        checked={monetization.monetization_enabled}
                        onChange={(e) => setMonetization({ ...monetization, monetization_enabled: e.target.checked })}
                      />
                    </Box>

                    <TextField
                      fullWidth
                      label="Premium Upgrade Price ($)"
                      value={monetization.premium_price}
                      onChange={(e) => setMonetization({ ...monetization, premium_price: e.target.value })}
                      variant="outlined"
                      InputProps={{ style: { color: "#fff" } }}
                      InputLabelProps={{ style: { color: "#888" } }}
                      sx={{ "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#333" }, "&:hover fieldset": { borderColor: "#555" } } }}
                    />

                    <TextField
                      fullWidth
                      label="Google AdSense / Publisher Unit ID"
                      value={monetization.ad_unit_id}
                      onChange={(e) => setMonetization({ ...monetization, ad_unit_id: e.target.value })}
                      variant="outlined"
                      InputProps={{ style: { color: "#fff" } }}
                      InputLabelProps={{ style: { color: "#888" } }}
                      sx={{ "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#333" }, "&:hover fieldset": { borderColor: "#555" } } }}
                    />

                    <Button
                      variant="contained"
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      sx={{ bgcolor: "#fff", color: "#000", fontWeight: 700, "&:hover": { bgcolor: "#eee" }, alignSelf: "flex-start", px: 4, py: 1.2 }}
                    >
                      {savingSettings ? <CircularProgress size={20} color="inherit" /> : "Save Changes"}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}
          </Box>
        )}
      </Box>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteUserOpen} onClose={() => setDeleteUserOpen(false)} PaperProps={{ style: { backgroundColor: "#1e1e1e", color: "#fff", border: "1px solid #333", borderRadius: 12 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm Complete User Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#aaa" }}>
            Are you absolutely sure you want to completely delete <strong>{userToDelete?.username}</strong>?
            This will permanently remove their profile, message history, chat memberships, and feedback from the database. This action is irreversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteUserOpen(false)} sx={{ color: "#aaa" }}>Cancel</Button>
          <Button onClick={handleDeleteUser} disabled={deletingUser} sx={{ bgcolor: "#FF5252", color: "#fff", "&:hover": { bgcolor: "#E53935" } }}>
            {deletingUser ? "Deleting..." : "Delete User"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminDashboard;
