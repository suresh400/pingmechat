import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Box, Stack, Typography, Button, Alert,
    CircularProgress, Link, Paper,
} from "@mui/material";
import { ChatCircleDots, ArrowLeft, ShieldCheck } from "phosphor-react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE } from "../../constants";
import Threads from "./Threads";

const RESEND_COOLDOWN = 60; // seconds

const OTPInput = ({ value, onChange, disabled }) => {
    const inputRefs = useRef([]);
    const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

    useEffect(() => {
        if (!value && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [value]);

    const handleChange = (idx, val) => {
        const cleaned = val.replace(/\D/g, "").slice(-1);
        const arr = digits.slice();
        arr[idx] = cleaned;
        onChange(arr.join(""));
        if (cleaned && idx < 5) {
            inputRefs.current[idx + 1]?.focus();
        }
    };

    const handleKeyDown = (idx, e) => {
        if (e.key === "Backspace") {
            if (!digits[idx] && idx > 0) {
                const arr = digits.slice();
                arr[idx - 1] = "";
                onChange(arr.join(""));
                inputRefs.current[idx - 1]?.focus();
            } else {
                const arr = digits.slice();
                arr[idx] = "";
                onChange(arr.join(""));
            }
        }
        if (e.key === "ArrowLeft" && idx > 0) inputRefs.current[idx - 1]?.focus();
        if (e.key === "ArrowRight" && idx < 5) inputRefs.current[idx + 1]?.focus();
    };

    const handlePaste = (e) => {
        const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (text) onChange(text.padEnd(6, "").slice(0, 6));
        e.preventDefault();
    };

    return (
        <Stack direction="row" spacing={{ xs: 0.8, sm: 1.5 }} justifyContent="center">
            {digits.map((d, i) => (
                <Box
                    key={i}
                    component="input"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    ref={(el) => (inputRefs.current[i] = el)}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    sx={{
                        width: { xs: 44, sm: 52 },
                        height: { xs: 52, sm: 62 },
                        textAlign: "center",
                        fontSize: { xs: 22, sm: 28 },
                        fontWeight: 800,
                        color: "#fff",
                        border: "2px solid",
                        borderColor: d ? "#3B82F6" : "rgba(255, 255, 255, 0.15)",
                        borderRadius: 2,
                        outline: "none",
                        background: d ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.02)",
                        cursor: disabled ? "not-allowed" : "text",
                        transition: "all 0.15s",
                        "&:focus": {
                            borderColor: "#3B82F6",
                            boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.2)",
                            background: "rgba(255, 255, 255, 0.08)",
                        },
                    }}
                />
            ))}
        </Stack>
    );
};

const OTPVerificationPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || "";

    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState("");
    const hasSubmittedRef = useRef(false); // prevents auto-submit loop

    // Redirect if no email passed
    useEffect(() => {
        if (!email) navigate("/forgot-password");
    }, [email, navigate]);

    // Resend cooldown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    // Reset the submission guard whenever the user changes the OTP
    useEffect(() => {
        hasSubmittedRef.current = false;
    }, [otp]);

    const handleVerify = useCallback(async () => {
        if (otp.length < 6 || loading || success) return;
        // Prevent auto-submit from re-triggering
        if (hasSubmittedRef.current) return;
        hasSubmittedRef.current = true;

        setError("");
        setResendMsg("");
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || "OTP verification failed.");
                // Clear OTP so user can re-enter
                setOtp("");
                if (data.code === "EXPIRED" || data.code === "MAX_ATTEMPTS") {
                    setTimeout(() => navigate("/forgot-password"), 3000);
                }
                return;
            }
            setSuccess(true);
            setTimeout(() => navigate("/reset-password", { state: { resetToken: data.resetToken, email } }), 1000);
        } catch {
            setError("Network error. Please try again.");
            setOtp("");
        } finally {
            setLoading(false);
        }
    }, [otp, email, navigate, loading, success]);

    // Auto-submit when all 6 digits entered (only once per OTP value)
    useEffect(() => {
        if (otp.length === 6 && !loading && !success && !hasSubmittedRef.current) {
            handleVerify();
        }
    }, [otp, handleVerify, loading, success]);

    const handleResend = async () => {
        if (cooldown > 0) return;
        setResendMsg("");
        setError("");
        setResending(true);
        try {
            const res = await fetch(`${API_BASE}/auth/resend-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.message || "Failed to resend OTP."); return; }
            setResendMsg("A new OTP has been sent to your email.");
            setOtp("");
            setCooldown(RESEND_COOLDOWN);
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setResending(false);
        }
    };

    const maskedEmail = email
        ? email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => a + "*".repeat(Math.min(b.length, 4)))
        : "";

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
                    <Paper elevation={0} sx={{ bgcolor: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "50%", p: 2, display: "inline-flex" }}>
                        <ShieldCheck size={36} color="#fff" weight="fill" />
                    </Paper>
                    <Typography variant="h6" fontWeight={800} color="#fff" textAlign="center">
                        Enter Verification Code
                    </Typography>
                    <Typography variant="body2" color="rgba(255, 255, 255, 0.6)" textAlign="center" lineHeight={1.6}>
                        We sent a 6-digit OTP to <strong>{maskedEmail}</strong>.<br />
                        It expires in 10 minutes.
                    </Typography>
                </Stack>

                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
                {resendMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{resendMsg}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>OTP verified! Redirecting…</Alert>}

                {/* OTP Input */}
                <Box mb={3}>
                    <OTPInput value={otp} onChange={setOtp} disabled={loading || success} />
                </Box>

                {/* Verify Button */}
                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleVerify}
                    disabled={otp.length < 6 || loading || success}
                    sx={{
                        backgroundColor: "#fff", color: "#000",
                        borderRadius: 2, py: 1.2, fontWeight: 800,
                        textTransform: "none", fontSize: 15, mb: 2,
                        "&:hover": { backgroundColor: "#e5e5e5" },
                        "&.Mui-disabled": { bgcolor: "rgba(255, 255, 255, 0.3)", color: "rgba(0,0,0,0.5)" },
                    }}
                >
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Verify OTP"}
                </Button>

                {/* Resend */}
                <Stack alignItems="center" spacing={0.5}>
                    <Typography variant="body2" color="rgba(255, 255, 255, 0.4)">
                        Didn't receive the code?{" "}
                        {cooldown > 0 ? (
                            <span style={{ color: "rgba(255, 255, 255, 0.6)", fontWeight: 600 }}>
                                Resend in {cooldown}s
                            </span>
                        ) : (
                            <Link
                                component="button"
                                onClick={handleResend}
                                disabled={resending}
                                sx={{ color: "#fff", fontWeight: 700, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                            >
                                {resending ? "Sending…" : "Resend OTP"}
                            </Link>
                        )}
                    </Typography>
                </Stack>

                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} mt={3}>
                    <ArrowLeft size={16} color="rgba(255, 255, 255, 0.6)" />
                    <Link
                        component="button"
                        onClick={() => navigate("/forgot-password")}
                        sx={{ color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                    >
                        Change email
                    </Link>
                </Stack>
            </Box>
        </Box>
    );
};

export default OTPVerificationPage;
