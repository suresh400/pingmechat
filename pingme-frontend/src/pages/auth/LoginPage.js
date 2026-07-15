import React, { useState, useEffect } from "react";
import {
    Box, Stack, Typography, TextField, Button,
    Alert, CircularProgress, Link
} from "@mui/material";
import { ChatCircleDots } from "phosphor-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Threads from "./Threads";
import { API_BASE } from "../../constants";

const LoginPage = () => {
    const navigate = useNavigate();
    const { sendOtp, verifyOtp } = useAuth();

    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [userCount, setUserCount] = useState(null);

    useEffect(() => {
        const fetchUserCount = async () => {
            try {
                const res = await fetch(`${API_BASE}/auth/users-count`);
                const data = await res.json();
                if (data && typeof data.total === "number") {
                    setUserCount(data.total);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchUserCount();
        const interval = setInterval(fetchUserCount, 10000); // check every 10s
        return () => clearInterval(interval);
    }, []);

    const handleSendCode = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setSuccess("");

        if (!phone.trim()) {
            setError("Phone number is required.");
            return;
        }

        if (!phone.trim().startsWith("+")) {
            setError("Phone number must include country code (e.g. +1234567890).");
            return;
        }

        setLoading(true);
        try {
            await sendOtp(phone);
            setOtpSent(true);
            setSuccess(`A verification code has been sent to ${phone}.`);
        } catch (err) {
            setError(err.message || "Failed to send OTP code.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (otp.length !== 6) {
            setError("Please enter a valid 6-digit verification code.");
            return;
        }

        setLoading(true);
        try {
            await verifyOtp(phone, otp);
            navigate("/app");
        } catch (err) {
            setError(err.message || "Invalid or expired verification code.");
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setOtp("");
        setOtpSent(false);
        setError("");
        setSuccess("");
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
                    <Typography variant="h4" fontWeight={900} sx={{ color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>PingMe</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                        {otpSent ? "Verify OTP code" : "Sign in with Phone"}
                    </Typography>
                </Stack>

                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{success}</Alert>}

                {!otpSent ? (
                    <form onSubmit={handleSendCode}>
                        <Stack spacing={2.5}>
                            <TextField
                                label="Phone Number"
                                name="phone"
                                type="tel"
                                fullWidth
                                required
                                placeholder="+1234567890"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                variant="outlined"
                                size="small"
                                helperText="Enter phone with country code (e.g., +15550199)"
                                FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.4)" } }}
                                sx={{
                                    "& .MuiInputBase-input": { color: "#fff" },
                                    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
                                    "& .MuiInputLabel-root.Mui-focused": { color: "#fff" },
                                    "& .MuiOutlinedInput-root": {
                                        "& fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                                        "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                                        "&.Mui-focused fieldset": { borderColor: "#fff" },
                                    },
                                }}
                            />
                            <Button
                                type="submit"
                                variant="contained"
                                fullWidth
                                disabled={loading}
                                sx={{
                                    backgroundColor: "#fff",
                                    color: "#000",
                                    borderRadius: 2,
                                    py: 1.2,
                                    fontWeight: 800,
                                    textTransform: "none",
                                    fontSize: 15,
                                    "&:hover": { backgroundColor: "#e5e5e5" },
                                }}
                            >
                                {loading ? <CircularProgress size={22} color="inherit" /> : "Send OTP"}
                            </Button>
                        </Stack>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyCode}>
                        <Stack spacing={2.5}>
                            <TextField
                                label="6-Digit OTP Code"
                                name="otp"
                                fullWidth
                                required
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                variant="outlined"
                                size="small"
                                sx={{
                                    "& .MuiInputBase-input": { color: "#fff" },
                                    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
                                    "& .MuiInputLabel-root.Mui-focused": { color: "#fff" },
                                    "& .MuiOutlinedInput-root": {
                                        "& fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                                        "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                                        "&.Mui-focused fieldset": { borderColor: "#fff" },
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
                                {loading ? <CircularProgress size={22} color="inherit" /> : "Verify & Sign In"}
                             </Button>
                            <Stack direction="row" justifyContent="space-between" mt={1}>
                                <Link
                                    component="button"
                                    type="button"
                                    onClick={() => handleSendCode(null)}
                                    disabled={loading}
                                    sx={{ color: "#3B82F6", fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                                >
                                    Resend Code
                                </Link>
                                <Link
                                    component="button"
                                    type="button"
                                    onClick={handleBack}
                                    sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer", "&:hover": { color: "#fff" } }}
                                >
                                    Change Phone Number
                                </Link>
                            </Stack>
                        </Stack>
                    </form>
                )}

                {/* Active users display */}
                {userCount !== null && (
                    <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
                        <Box sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 1.2,
                            bgcolor: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "20px",
                            px: 2,
                            py: 0.6,
                        }}>
                            <Box sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: "#4CAF50",
                                boxShadow: "0 0 0 0 rgba(76, 175, 80, 0.7)",
                                animation: "pulse 1.8s infinite",
                                "@keyframes pulse": {
                                    "0%": {
                                        transform: "scale(0.95)",
                                        boxShadow: "0 0 0 0 rgba(76, 175, 80, 0.7)",
                                    },
                                    "70%": {
                                        transform: "scale(1)",
                                        boxShadow: "0 0 0 6px rgba(76, 175, 80, 0)",
                                    },
                                    "100%": {
                                        transform: "scale(0.95)",
                                        boxShadow: "0 0 0 0 rgba(76, 175, 80, 0)",
                                    }
                                }
                            }} />
                            <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.7)", fontWeight: 600, fontSize: 11, letterSpacing: 0.3 }}>
                                Registered Members: <span style={{ color: "#fff", fontWeight: 800 }}>{userCount}</span>
                            </Typography>
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default LoginPage;
