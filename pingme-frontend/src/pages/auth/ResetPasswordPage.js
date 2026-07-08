import React, { useState, useEffect } from "react";
import {
    Box, Stack, Typography, TextField, Button,
    Alert, CircularProgress, Link, LinearProgress,
} from "@mui/material";
import { ChatCircleDots, ArrowLeft, Eye, EyeSlash, Lock, CheckCircle } from "phosphor-react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE } from "../../constants";
import Threads from "./Threads";

// Password strength helpers
const calcStrength = (pw) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0-5
};

const strengthLabel = (s) => {
    if (s === 0) return { label: "", color: "#e0e0e0" };
    if (s <= 1) return { label: "Weak", color: "#f44336" };
    if (s === 2) return { label: "Fair", color: "#ff9800" };
    if (s === 3) return { label: "Good", color: "#2196f3" };
    return { label: "Strong", color: "#4caf50" };
};

const StrengthBar = ({ password }) => {
    const score = calcStrength(password);
    const { label, color } = strengthLabel(score);
    if (!password) return null;
    return (
        <Box>
            <LinearProgress
                variant="determinate"
                value={(score / 5) * 100}
                sx={{
                    height: 5, borderRadius: 99,
                    bgcolor: "rgba(255, 255, 255, 0.1)",
                    "& .MuiLinearProgress-bar": { bgcolor: color, transition: "width 0.4s" },
                }}
            />
            <Typography variant="caption" sx={{ color, fontWeight: 600 }}>{label}</Typography>
        </Box>
    );
};

const PasswordRule = ({ met, label }) => (
    <Stack direction="row" spacing={0.8} alignItems="center">
        <CheckCircle
            size={14}
            weight={met ? "fill" : "regular"}
            color={met ? "#4caf50" : "rgba(255, 255, 255, 0.3)"}
        />
        <Typography variant="caption" sx={{ color: met ? "#4caf50" : "rgba(255, 255, 255, 0.5)" }}>{label}</Typography>
    </Stack>
);

const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const resetToken = location.state?.resetToken || "";
    const email = location.state?.email || "";

    const [form, setForm] = useState({ newPassword: "", confirm: "" });
    const [showPw, setShowPw] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!resetToken) navigate("/forgot-password");
    }, [resetToken, navigate]);

    const strength = calcStrength(form.newPassword);
    const rules = [
        { met: form.newPassword.length >= 8, label: "At least 8 characters" },
        { met: /[A-Z]/.test(form.newPassword), label: "One uppercase letter" },
        { met: /[0-9]/.test(form.newPassword), label: "One number" },
        { met: /[^A-Za-z0-9]/.test(form.newPassword), label: "One special character" },
        { met: form.newPassword === form.confirm && form.confirm.length > 0, label: "Passwords match" },
    ];
    const isValid = strength >= 2 && form.newPassword === form.confirm && form.newPassword.length >= 8;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid) {
            if (form.newPassword !== form.confirm) { setError("Passwords do not match."); return; }
            if (form.newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
            return;
        }
        setError("");
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resetToken, newPassword: form.newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || "Failed to reset password.");
                if (data.code === "TOKEN_EXPIRED") {
                    setTimeout(() => navigate("/forgot-password"), 3000);
                }
                return;
            }
            setSuccess(true);
            setTimeout(() => navigate("/login"), 3000);
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <Box
                sx={{
                    position: "relative",
                    minHeight: "100vh",
                    bgcolor: "#030303",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    p: 2,
                }}
            >
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        zIndex: 0,
                    }}
                >
                    <Threads
                        amplitude={1.2}
                        distance={0.3}
                        enableMouseInteraction
                        color={[0.2, 0.5, 1.0]}
                    />
                </Box>

                <Box
                    sx={{
                        position: "relative",
                        zIndex: 1,
                        backgroundColor: "rgba(15, 15, 15, 0.7)",
                        backdropFilter: "blur(18px) saturate(180%)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 4,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                        p: { xs: 3, sm: 5 },
                        width: "100%",
                        maxWidth: 420,
                        textAlign: "center",
                    }}
                >
                    <Stack alignItems="center" spacing={2}>
                        <Box sx={{
                            width: 80, height: 80, borderRadius: "50%",
                            bgcolor: "rgba(76, 175, 80, 0.1)",
                            border: "1px solid rgba(76, 175, 80, 0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <CheckCircle size={48} color="#4caf50" weight="fill" />
                        </Box>
                        <Typography variant="h5" fontWeight={800} color="#fff">Password Reset!</Typography>
                        <Typography variant="body2" color="rgba(255, 255, 255, 0.6)" lineHeight={1.6}>
                            Your password has been reset successfully.<br />
                            Redirecting to login in 3 seconds…
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => navigate("/login")}
                            sx={{
                                bgcolor: "#fff", color: "#000", borderRadius: 2,
                                textTransform: "none", fontWeight: 700,
                                "&:hover": { bgcolor: "#e5e5e5" },
                            }}
                        >
                            Go to Login Now
                        </Button>
                    </Stack>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                position: "relative",
                minHeight: "100vh",
                bgcolor: "#030303",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                p: 2,
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: 0,
                }}
            >
                <Threads
                    amplitude={1.2}
                    distance={0.3}
                    enableMouseInteraction
                    color={[0.2, 0.5, 1.0]}
                />
            </Box>

            <Box
                sx={{
                    position: "relative",
                    zIndex: 1,
                    backgroundColor: "rgba(15, 15, 15, 0.7)",
                    backdropFilter: "blur(18px) saturate(180%)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 4,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                    p: { xs: 3, sm: 5 },
                    width: "100%",
                    maxWidth: 440,
                }}
            >
                {/* Logo */}
                <Stack alignItems="center" spacing={1} mb={3}>
                    <Box
                        sx={{
                            width: 56, height: 56, borderRadius: 2,
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    >
                        <ChatCircleDots size={30} color="#fff" weight="fill" />
                    </Box>
                    <Typography variant="h5" fontWeight={900} sx={{ color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>
                        PingMe
                    </Typography>
                </Stack>

                {/* Icon + Title */}
                <Stack alignItems="center" spacing={1} mb={3}>
                    <Box sx={{ bgcolor: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "50%", p: 2, display: "inline-flex" }}>
                        <Lock size={34} color="#fff" weight="fill" />
                    </Box>
                    <Typography variant="h6" fontWeight={800} color="#fff">Create New Password</Typography>
                    <Typography variant="body2" color="rgba(255, 255, 255, 0.6)" textAlign="center" lineHeight={1.6}>
                        Set a strong new password for <strong>{email}</strong>.
                    </Typography>
                </Stack>

                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

                <form onSubmit={handleSubmit}>
                    <Stack spacing={2.5}>
                        {/* New Password */}
                        <Box>
                            <TextField
                                label="New Password"
                                type={showPw ? "text" : "password"}
                                fullWidth required
                                value={form.newPassword}
                                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                                variant="outlined" size="small"
                                disabled={loading}
                                InputProps={{
                                    endAdornment: (
                                        <Box component="button" type="button" onClick={() => setShowPw(!showPw)}
                                            sx={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255, 255, 255, 0.6)", display: "flex" }}>
                                            {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                                        </Box>
                                    ),
                                }}
                                sx={{
                                    mb: 1,
                                    "& .MuiInputBase-input": { color: "#fff" },
                                    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
                                    "& .MuiInputLabel-root.Mui-focused": { color: "#3B82F6" },
                                    "& .MuiOutlinedInput-root": {
                                        "& fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                                        "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                                        "&.Mui-focused fieldset": { borderColor: "#3B82F6" },
                                    },
                                }}
                            />
                            <StrengthBar password={form.newPassword} />
                        </Box>

                        {/* Confirm Password */}
                        <TextField
                            label="Confirm Password"
                            type={showConfirm ? "text" : "password"}
                            fullWidth required
                            value={form.confirm}
                            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                            variant="outlined" size="small"
                            disabled={loading}
                            error={form.confirm.length > 0 && form.newPassword !== form.confirm}
                            helperText={form.confirm.length > 0 && form.newPassword !== form.confirm ? "Passwords do not match" : ""}
                            InputProps={{
                                endAdornment: (
                                    <Box component="button" type="button" onClick={() => setShowConfirm(!showConfirm)}
                                        sx={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255, 255, 255, 0.6)", display: "flex" }}>
                                        {showConfirm ? <EyeSlash size={18} /> : <Eye size={18} />}
                                    </Box>
                                ),
                            }}
                            sx={{
                                "& .MuiInputBase-input": { color: "#fff" },
                                "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
                                "& .MuiInputLabel-root.Mui-focused": { color: "#3B82F6" },
                                "& .MuiOutlinedInput-root": {
                                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                                    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                                    "&.Mui-focused fieldset": { borderColor: "#3B82F6" },
                                },
                            }}
                        />

                        {/* Password Rules */}
                        {form.newPassword.length > 0 && (
                            <Box sx={{ bgcolor: "rgba(255, 255, 255, 0.03)", borderRadius: 2, p: 1.5, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                                <Stack spacing={0.5}>
                                    {rules.map((r, i) => <PasswordRule key={i} {...r} />)}
                                </Stack>
                            </Box>
                        )}

                        <Button
                            type="submit"
                            variant="contained"
                            fullWidth
                            disabled={loading || !isValid}
                            sx={{
                                backgroundColor: "#fff", color: "#000",
                                borderRadius: 2, py: 1.2, fontWeight: 800,
                                textTransform: "none", fontSize: 15,
                                "&:hover": { backgroundColor: "#e5e5e5" },
                                "&.Mui-disabled": { bgcolor: "rgba(255, 255, 255, 0.3)", color: "rgba(0,0,0,0.5)" },
                            }}
                        >
                            {loading ? <CircularProgress size={22} color="inherit" /> : "Reset Password"}
                        </Button>
                    </Stack>
                </form>

                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} mt={3}>
                    <ArrowLeft size={16} color="rgba(255, 255, 255, 0.6)" />
                    <Link
                        component="button"
                        onClick={() => navigate("/login")}
                        sx={{ color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                    >
                        Back to Login
                    </Link>
                </Stack>
            </Box>
        </Box>
    );
};

export default ResetPasswordPage;
