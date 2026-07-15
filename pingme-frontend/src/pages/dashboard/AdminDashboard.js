import React, { useState, useEffect } from "react";
import {
  Box, Stack, Typography, TextField, Button, Paper, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, CircularProgress, Alert, Snackbar, Grid, Card, CardContent
} from "@mui/material";
import {
  Trash, ChartBar, Users, ChatCircleDots, ShieldCheck,
  Sliders, Star, SignOut, StarHalf, Megaphone, Coins
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

  // Tab state: 0 = Users, 1 = Feedback, 2 = Monetization
  const [activeTab, setActiveTab] = useState(0);

  // Data states
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [monetization, setMonetization] = useState({
    monetization_enabled: false,
    premium_price: "4.99",
    ad_unit_id: "ca-pub-123456789"
  });

  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

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

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardData();
    }
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
            <Tab label="Feedbacks Log" icon={<Megaphone size={18} />} iconPosition="start" />
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

            {/* Tab 1: Feedback Logs */}
            {activeTab === 1 && (
              <Stack spacing={3}>
                {feedbacks.length === 0 ? (
                  <Paper sx={{ p: 4, bgcolor: "#1e1e1e", border: "1px solid #222", textAlign: "center", borderRadius: 3 }}>
                    <Typography color="text.secondary">No feedback submissions yet.</Typography>
                  </Paper>
                ) : (
                  feedbacks.map((f) => (
                    <Paper key={f.id} sx={{ p: 3, bgcolor: "#1e1e1e", border: "1px solid #222", borderRadius: 3 }}>
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Avatar src={f.avatar} sx={{ width: 32, height: 32 }} />
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{f.username}</Typography>
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
                          <Typography variant="body2" fontWeight={700} ml={1}>{f.rating}/5 Rating</Typography>
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
                  ))
                )}
              </Stack>
            )}

            {/* Tab 2: Monetization Center */}
            {activeTab === 2 && (
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
