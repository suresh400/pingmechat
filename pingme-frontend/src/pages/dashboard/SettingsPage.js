import React, { useState, useRef } from "react";
import {
    Box, Stack, Typography, Avatar, TextField, Button,
    Switch, Alert, Snackbar, Paper, Grid, CircularProgress, IconButton, useMediaQuery, useTheme
} from "@mui/material";
import {
    User, Bell, Palette, Moon, Sun, SignOut, Lock, Eye, EyeSlash
} from "phosphor-react";
import { useAuth } from "../../contexts/AuthContext";
import useSettings from "../../hooks/useSettings";
import { API_BASE } from "../../constants";


import { useEffect } from "react";

const SettingsPage = () => {
    const { currentUser, authFetch, logout, updateCurrentUser } = useAuth();
    const { themeMode, onToggleMode } = useSettings();
    const isDark = themeMode === "dark";
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const [profile, setProfile] = useState({
        username: currentUser?.username || "",
        bio: currentUser?.bio || "",
        avatar: currentUser?.avatar || ""
    });
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [showEmail, setShowEmail] = useState(true); // privacy toggle

    const handleChangePassword = async () => {
        if (passwords.new.length < 8) {
            setSnackbar({ open: true, message: "New password must be at least 8 characters long.", severity: "error" });
            return;
        }
        if (passwords.new !== passwords.confirm) {
            setSnackbar({ open: true, message: "New passwords do not match.", severity: "error" });
            return;
        }
        setChangingPassword(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/change-password`, {
                method: "PUT",
                body: JSON.stringify({
                    currentPassword: passwords.current,
                    newPassword: passwords.new
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setSnackbar({ open: true, message: "Password changed successfully! ✓", severity: "success" });
            setPasswords({ current: "", new: "", confirm: "" });
        } catch (err) {
            setSnackbar({ open: true, message: err.message, severity: "error" });
        } finally {
            setChangingPassword(false);
        }
    };

    // Update local state if currentUser changes (e.g. after first load)
    useEffect(() => {
        if (currentUser) {
            setProfile({
                username: currentUser.username || "",
                bio: currentUser.bio || "",
                avatar: currentUser.avatar || ""
            });
            if (currentUser.show_email !== undefined) {
                setShowEmail(currentUser.show_email !== false);
            }
        }
    }, [currentUser]);

    const handleProfileSave = async (overrideAvatar) => {
        setSaving(true);
        const avatarToSave = overrideAvatar !== undefined ? overrideAvatar : profile.avatar;
        try {
            const res = await authFetch(`${API_BASE}/auth/profile`, {
                method: "PUT",
                body: JSON.stringify({
                    username: profile.username,
                    bio: profile.bio,
                    avatar: avatarToSave
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setSnackbar({ open: true, message: "Profile updated successfully! ✓", severity: "success" });

            // Sync React state AND localStorage atomically so changes show everywhere without refresh
            updateCurrentUser(data.user);
            setProfile(prev => ({ ...prev, ...data.user }));
        } catch (err) {
            setSnackbar({ open: true, message: err.message, severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await authFetch(`${API_BASE}/upload`, {
                method: "POST",
                body: formData,
            });

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                console.error("Non-JSON response:", text);
                throw new Error("Server returned non-JSON response. Check backend logs.");
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Upload failed");

            // Update local profile state with new avatar URL
            const newAvatarUrl = data.url;
            setProfile(prev => ({ ...prev, avatar: newAvatarUrl }));

            // Auto-save profile with new avatar so it persists immediately
            await handleProfileSave(newAvatarUrl);
        } catch (err) {
            setSnackbar({ open: true, message: err.message, severity: "error" });
        } finally {
            setUploading(false);
        }
    };

    const monochromaticStyles = {
        primary: isDark ? "#fff" : "#000",
        secondary: isDark ? "#888" : "#666",
        bg: isDark ? "#111" : "#f9f9f9",
        paper: isDark ? "#000" : "#fff",
        border: isDark ? "#222" : "#eee",
    };

    return (
        <Box sx={{ flexGrow: 1, overflowY: "auto", p: { xs: 2, md: 6 }, bgcolor: monochromaticStyles.bg, minHeight: "100%" }}>
            <Box sx={{ maxWidth: 800, mx: "auto" }}>
                {/* Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={isMobile ? 4 : 6}>
                    <Stack direction="row" alignItems="center" gap={2}>
                        <Box sx={{ bgcolor: monochromaticStyles.primary, borderRadius: 1.5, p: 1, display: "flex" }}>
                            <Palette size={isMobile ? 20 : 24} color={isDark ? "#000" : "#fff"} weight="bold" />
                        </Box>
                        <Typography variant={isMobile ? "h5" : "h4"} fontWeight={900} sx={{ color: monochromaticStyles.primary, letterSpacing: -1 }}>Settings</Typography>
                    </Stack>
                    <Button
                        variant="outlined"
                        onClick={logout}
                        startIcon={<SignOut />}
                        sx={{
                            borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3,
                            borderColor: monochromaticStyles.border, color: monochromaticStyles.primary,
                            "&:hover": { borderColor: monochromaticStyles.primary, bgcolor: "transparent" }
                        }}
                    >
                        Log Out
                    </Button>
                </Stack>

                <Grid container spacing={4}>
                    {/* Left Side - Profile */}
                    <Grid item xs={12} md={7}>
                        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: "1px solid", borderColor: monochromaticStyles.border, bgcolor: monochromaticStyles.paper }}>
                            <Typography variant="h6" fontWeight={800} mb={4} sx={{ color: monochromaticStyles.primary }}>Account Profile</Typography>

                            <Stack direction="row" alignItems="center" gap={4} mb={5}>
                                <Box sx={{ position: "relative" }}>
                                    <Avatar src={profile.avatar} sx={{ width: 100, height: 100, border: "2px solid", borderColor: monochromaticStyles.primary }}>
                                        {uploading && <CircularProgress size={40} sx={{ color: monochromaticStyles.primary }} />}
                                    </Avatar>
                                    <input
                                        type="file"
                                        hidden
                                        ref={fileInputRef}
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        sx={{
                                            position: "absolute", bottom: 0, right: 0,
                                            bgcolor: monochromaticStyles.primary, color: isDark ? "#000" : "#fff",
                                            "&:hover": { bgcolor: monochromaticStyles.primary, opacity: 0.9 }
                                        }}
                                    >
                                        <User size={16} weight="bold" />
                                    </IconButton>
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight={700} sx={{ color: monochromaticStyles.primary }}>{currentUser?.username}</Typography>
                                    <Typography variant="body2" sx={{ color: monochromaticStyles.secondary }}>
                                        {currentUser?.email?.endsWith("@phone.supabase")
                                            ? currentUser.email.replace("@phone.supabase", "")
                                            : currentUser?.email}
                                    </Typography>
                                </Box>
                            </Stack>

                            <Stack spacing={3}>
                                <TextField
                                    fullWidth
                                    label="Username"
                                    value={profile.username}
                                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                                    variant="standard"
                                    InputLabelProps={{ shrink: true, sx: { color: monochromaticStyles.secondary, fontWeight: 600 } }}
                                    sx={{ "& .MuiInput-underline:before": { borderBottomColor: monochromaticStyles.border } }}
                                />
                                <TextField
                                    fullWidth
                                    label="Bio / Status"
                                    multiline
                                    rows={3}
                                    value={profile.bio}
                                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                                    variant="standard"
                                    placeholder="Tell the world about yourself..."
                                    InputLabelProps={{ shrink: true, sx: { color: monochromaticStyles.secondary, fontWeight: 600 } }}
                                    sx={{ "& .MuiInput-underline:before": { borderBottomColor: monochromaticStyles.border } }}
                                />
                                <Button
                                    fullWidth
                                    variant="contained"
                                    disabled={saving}
                                    onClick={() => handleProfileSave()}
                                    sx={{
                                        mt: 2, bgcolor: monochromaticStyles.primary, color: isDark ? "#000" : "#fff",
                                        borderRadius: 2, py: 1.5, fontWeight: 800, textTransform: "none",
                                        "&:hover": { bgcolor: monochromaticStyles.primary, opacity: 0.9 },
                                        "&.Mui-disabled": { bgcolor: monochromaticStyles.secondary }
                                    }}
                                >
                                    {saving ? <CircularProgress size={24} color="inherit" /> : "Save Profile Changes"}
                                </Button>
                            </Stack>
                        </Paper>
                    </Grid>

                    {/* Right Side - Preferences */}
                    <Grid item xs={12} md={5}>
                        <Stack spacing={3}>
                            {/* Theme Section */}
                            <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: "1px solid", borderColor: monochromaticStyles.border, bgcolor: monochromaticStyles.paper }}>
                                <Typography variant="subtitle1" fontWeight={800} mb={3} sx={{ color: monochromaticStyles.primary, display: "flex", alignItems: "center", gap: 1 }}>
                                    <Palette size={20} weight="bold" /> Theme Mode
                                </Typography>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderRadius: 2, bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                                    <Stack direction="row" alignItems="center" gap={1.5}>
                                        {isDark ? <Moon color={monochromaticStyles.primary} weight="bold" /> : <Sun color={monochromaticStyles.primary} weight="bold" />}
                                        <Typography variant="body2" fontWeight={600} sx={{ color: monochromaticStyles.primary }}>{isDark ? "Dark Appearance" : "Light Appearance"}</Typography>
                                    </Stack>
                                    <Switch
                                        checked={isDark}
                                        onChange={onToggleMode}
                                        sx={{
                                            "& .MuiSwitch-switchBase.Mui-checked": { color: monochromaticStyles.primary },
                                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: monochromaticStyles.primary }
                                        }}
                                    />
                                </Box>
                            </Paper>

                            {/* Preferences Section */}
                            <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: "1px solid", borderColor: monochromaticStyles.border, bgcolor: monochromaticStyles.paper }}>
                                <Typography variant="subtitle1" fontWeight={800} mb={3} sx={{ color: monochromaticStyles.primary, display: "flex", alignItems: "center", gap: 1 }}>
                                    <Bell size={20} weight="bold" /> Preferences
                                </Typography>
                                <Stack spacing={1}>
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1 }}>
                                        <Box>
                                            <Typography variant="body2" fontWeight={600} sx={{ color: monochromaticStyles.primary }}>
                                                 {currentUser?.email?.endsWith("@phone.supabase") ? "Show Phone Number to Others" : "Show Email to Others"}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: monochromaticStyles.secondary }}>
                                                 {currentUser?.email?.endsWith("@phone.supabase") ? "Let contacts see your phone number in your profile" : "Let contacts see your email in your profile"}
                                            </Typography>
                                        </Box>
                                        <Switch
                                            size="small"
                                            checked={showEmail}
                                            onChange={async (e) => {
                                                const val = e.target.checked;
                                                setShowEmail(val);
                                                try {
                                                    await authFetch(`${API_BASE}/auth/show-email`, {
                                                        method: "PUT",
                                                        body: JSON.stringify({ show_email: val }),
                                                    });
                                                    updateCurrentUser({ show_email: val });
                                                } catch { setShowEmail(!val); } // revert on error
                                            }}
                                            sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: monochromaticStyles.primary }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: monochromaticStyles.primary } }}
                                        />
                                    </Box>
                                </Stack>
                            </Paper>

                            {/* Change Password (Security) Section */}
                            <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: "1px solid", borderColor: monochromaticStyles.border, bgcolor: monochromaticStyles.paper }}>
                                <Typography variant="subtitle1" fontWeight={800} mb={3} sx={{ color: monochromaticStyles.primary, display: "flex", alignItems: "center", gap: 1 }}>
                                    <Lock size={20} weight="bold" /> Security & Password
                                </Typography>
                                <Stack spacing={2.5}>
                                    <TextField
                                        fullWidth
                                        type={showCurrentPw ? "text" : "password"}
                                        label="Current Password"
                                        value={passwords.current}
                                        onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                        variant="standard"
                                        InputLabelProps={{ shrink: true, sx: { color: monochromaticStyles.secondary, fontWeight: 600 } }}
                                        InputProps={{
                                            endAdornment: (
                                                <IconButton size="small" onClick={() => setShowCurrentPw(!showCurrentPw)} sx={{ color: monochromaticStyles.secondary }}>
                                                    {showCurrentPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                                                </IconButton>
                                            )
                                        }}
                                        sx={{ "& .MuiInput-underline:before": { borderBottomColor: monochromaticStyles.border } }}
                                    />
                                    <TextField
                                        fullWidth
                                        type={showNewPw ? "text" : "password"}
                                        label="New Password"
                                        value={passwords.new}
                                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                        variant="standard"
                                        InputLabelProps={{ shrink: true, sx: { color: monochromaticStyles.secondary, fontWeight: 600 } }}
                                        InputProps={{
                                            endAdornment: (
                                                <IconButton size="small" onClick={() => setShowNewPw(!showNewPw)} sx={{ color: monochromaticStyles.secondary }}>
                                                    {showNewPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                                                </IconButton>
                                            )
                                        }}
                                        sx={{ "& .MuiInput-underline:before": { borderBottomColor: monochromaticStyles.border } }}
                                    />
                                    <TextField
                                        fullWidth
                                        type={showConfirmPw ? "text" : "password"}
                                        label="Confirm New Password"
                                        value={passwords.confirm}
                                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                        variant="standard"
                                        InputLabelProps={{ shrink: true, sx: { color: monochromaticStyles.secondary, fontWeight: 600 } }}
                                        InputProps={{
                                            endAdornment: (
                                                <IconButton size="small" onClick={() => setShowConfirmPw(!showConfirmPw)} sx={{ color: monochromaticStyles.secondary }}>
                                                    {showConfirmPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                                                </IconButton>
                                            )
                                        }}
                                        sx={{ "& .MuiInput-underline:before": { borderBottomColor: monochromaticStyles.border } }}
                                    />
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        disabled={changingPassword || !passwords.current || !passwords.new || !passwords.confirm}
                                        onClick={handleChangePassword}
                                        sx={{
                                            mt: 1, bgcolor: monochromaticStyles.primary, color: isDark ? "#000" : "#fff",
                                            borderRadius: 2, py: 1.2, fontWeight: 800, textTransform: "none",
                                            "&:hover": { bgcolor: monochromaticStyles.primary, opacity: 0.9 },
                                            "&.Mui-disabled": { bgcolor: monochromaticStyles.secondary }
                                        }}
                                    >
                                        {changingPassword ? <CircularProgress size={22} color="inherit" /> : "Change Password"}
                                    </Button>
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid>
                </Grid>

                <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2, fontWeight: 600 }}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </Box>
    );
};

export default SettingsPage;
