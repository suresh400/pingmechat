import React, { useState, useEffect } from "react";
import {
    Box, Stack, Typography, TextField, Button, IconButton,
    InputAdornment, Alert, Link, CircularProgress,
} from "@mui/material";
import { Eye, EyeSlash, ChatCircleDots, CheckCircle, XCircle } from "phosphor-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

import { API_BASE } from "../../constants";
import Threads from "./Threads";

const RegisterPage = () => {
    const navigate = useNavigate();
    const { register } = useAuth();

    const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // OTP verification mode
    const [otpRequired, setOtpRequired] = useState(false);
    const [otp, setOtp] = useState("");

    // Live username check
    const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken'

    useEffect(() => {
        if (otpRequired || !form.username.trim() || form.username.length < 3) { setUsernameStatus(null); return; }
        setUsernameStatus("checking");
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/auth/check-username?username=${encodeURIComponent(form.username)}`);
                const data = await res.json();
                setUsernameStatus(data.available ? "available" : "taken");
            } catch { setUsernameStatus(null); }
        }, 400);
        return () => clearTimeout(timer);
    }, [form.username, otpRequired]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");
        if (!otpRequired) {
            if (usernameStatus === "taken") { setError("Username is already taken."); return; }
            if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
            if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
        } else {
            if (otp.length !== 6) { setError("Please enter a valid 6-digit verification code."); return; }
        }
        setLoading(true);
        try {
            const res = await register(form.username, form.email, form.password, otpRequired ? otp : undefined);
            if (res && res.otpRequired) {
                setOtpRequired(true);
                setSuccessMessage(res.message);
            } else {
                navigate("/app");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError("");
        setSuccessMessage("");
        setLoading(true);
        try {
            const res = await register(form.username, form.email, form.password);
            if (res && res.otpRequired) {
                setSuccessMessage("Verification code resent successfully.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const usernameAdornment = () => {
        if (usernameStatus === "checking") return <CircularProgress size={16} />;
        if (usernameStatus === "available") return <CheckCircle size={18} color="#4CAF50" weight="fill" />;
        if (usernameStatus === "taken") return <XCircle size={18} color="#F44336" weight="fill" />;
        return null;
    };

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
                    p: 5,
                    width: "100%",
                    maxWidth: 440,
                }}
            >
                <Stack alignItems="center" spacing={1} mb={4}>
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
                    <Typography variant="h5" fontWeight={800} sx={{ color: "#fff" }}>Create account</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>Join PingMe — chat, connect, belong</Typography>
                </Stack>

                {successMessage && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{successMessage}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

                <form onSubmit={handleSubmit}>
                    <Stack spacing={2.5}>
                        {!otpRequired ? (
                            <>
                                <TextField
                                    label="Username"
                                    name="username"
                                    fullWidth required
                                    value={form.username}
                                    onChange={handleChange}
                                    variant="outlined" size="small"
                                    error={usernameStatus === "taken"}
                                    helperText={usernameStatus === "taken" ? "Username already taken" : usernameStatus === "available" ? "✓ Username available" : ""}
                                    FormHelperTextProps={{ sx: { color: usernameStatus === "available" ? "#4CAF50" : "error.main", fontWeight: 600 } }}
                                    InputProps={{ endAdornment: <InputAdornment position="end" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>{usernameAdornment()}</InputAdornment> }}
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
                                <TextField
                                    label="Email address"
                                    name="email"
                                    type="email"
                                    fullWidth required
                                    value={form.email}
                                    onChange={handleChange}
                                    variant="outlined" size="small"
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
                                <TextField
                                    label="Password"
                                    name="password"
                                    type={showPw ? "text" : "password"}
                                    fullWidth required
                                    value={form.password}
                                    onChange={handleChange}
                                    variant="outlined" size="small"
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setShowPw(!showPw)} edge="end" size="small" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                                                    {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                                                </IconButton>
                                            </InputAdornment>
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
                                <TextField
                                    label="Confirm Password"
                                    name="confirm"
                                    type="password"
                                    fullWidth required
                                    value={form.confirm}
                                    onChange={handleChange}
                                    variant="outlined" size="small"
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
                                <Button
                                    type="submit"
                                    variant="contained"
                                    fullWidth
                                    disabled={loading || usernameStatus === "taken" || usernameStatus === "checking"}
                                    sx={{
                                        backgroundColor: "#fff",
                                        color: "#000",
                                        borderRadius: 2,
                                        py: 1.2,
                                        fontWeight: 800,
                                        textTransform: "none",
                                        fontSize: 15,
                                        "&:hover": { backgroundColor: "#e5e5e5" },
                                        "&.Mui-disabled": { backgroundColor: "rgba(255, 255, 255, 0.3)", color: "rgba(0,0,0,0.5)" }
                                    }}
                                >
                                    {loading ? <CircularProgress size={22} color="inherit" /> : "Create Account"}
                                </Button>
                            </>
                        ) : (
                            <>
                                <TextField
                                    label="6-Digit Verification Code"
                                    name="otp"
                                    fullWidth required
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    variant="outlined" size="small"
                                    placeholder="123456"
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
                                <Button
                                    type="submit"
                                    variant="contained"
                                    fullWidth
                                    disabled={loading || otp.length !== 6}
                                    sx={{
                                        backgroundColor: "#fff",
                                        color: "#000",
                                        borderRadius: 2,
                                        py: 1.2,
                                        fontWeight: 800,
                                        textTransform: "none",
                                        fontSize: 15,
                                        "&:hover": { backgroundColor: "#e5e5e5" },
                                        "&.Mui-disabled": { backgroundColor: "rgba(255, 255, 255, 0.3)", color: "rgba(0,0,0,0.5)" }
                                    }}
                                >
                                    {loading ? <CircularProgress size={22} color="inherit" /> : "Verify & Create Account"}
                                </Button>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                                    <Link
                                        component="button"
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={loading}
                                        sx={{ color: "#3B82F6", fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                                    >
                                        Resend Code
                                    </Link>
                                    <Link
                                        component="button"
                                        type="button"
                                        onClick={() => {
                                            setOtpRequired(false);
                                            setOtp("");
                                            setError("");
                                            setSuccessMessage("");
                                        }}
                                        sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer", "&:hover": { color: "#fff" } }}
                                    >
                                        Edit Details
                                    </Link>
                                </Stack>
                            </>
                        )}
                    </Stack>
                </form>

                <Typography variant="body2" align="center" sx={{ mt: 3, color: "rgba(255,255,255,0.6)" }}>
                    Already have an account?{" "}
                    <Link
                        component="button"
                        type="button"
                        onClick={() => navigate("/login")}
                        sx={{ color: "#fff", fontWeight: 800, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                    >
                        Sign In
                    </Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default RegisterPage;
