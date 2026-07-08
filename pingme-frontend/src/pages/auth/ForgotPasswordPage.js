import React, { useState } from "react";
import {
    Box, Stack, Typography, TextField, Button,
    Alert, CircularProgress, Link,
} from "@mui/material";
import { ChatCircleDots, ArrowLeft, EnvelopeSimple } from "phosphor-react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../constants";
import Threads from "./Threads";

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) { setError("Please enter your email address."); return; }
        setError("");
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || "Something went wrong.");
                return;
            }
            setSuccess(true);
            // Redirect to OTP page after short delay
            setTimeout(() => navigate("/verify-otp", { state: { email: email.trim().toLowerCase() } }), 1500);
        } catch {
            setError("Network error. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
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
                }}
            >
                {/* Logo */}
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
                    <Typography variant="h5" fontWeight={900} sx={{ color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>
                        PingMe
                    </Typography>
                </Stack>

                {/* Title */}
                <Stack spacing={0.5} mb={3}>
                    <Typography variant="h6" fontWeight={800} color="#fff">Forgot Password?</Typography>
                    <Typography variant="body2" color="rgba(255, 255, 255, 0.6)" lineHeight={1.6}>
                        No worries! Enter your registered email and we'll send you a 6-digit OTP to reset your password.
                    </Typography>
                </Stack>

                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
                {success && (
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                        OTP sent! Redirecting to verification page…
                    </Alert>
                )}

                {!success && (
                    <form onSubmit={handleSubmit}>
                        <Stack spacing={2.5}>
                            <TextField
                                label="Registered email address"
                                type="email"
                                fullWidth
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                variant="outlined"
                                size="small"
                                disabled={loading}
                                InputProps={{
                                    startAdornment: <EnvelopeSimple size={18} style={{ marginRight: 8, color: "rgba(255, 255, 255, 0.6)" }} />,
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
                            <Button
                                type="submit"
                                variant="contained"
                                fullWidth
                                disabled={loading}
                                sx={{
                                    backgroundColor: "#fff", color: "#000",
                                    borderRadius: 2, py: 1.2, fontWeight: 800,
                                    textTransform: "none", fontSize: 15,
                                    "&:hover": { backgroundColor: "#e5e5e5" },
                                }}
                            >
                                {loading ? <CircularProgress size={22} color="inherit" /> : "Send OTP"}
                            </Button>
                        </Stack>
                    </form>
                )}

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

export default ForgotPasswordPage;
