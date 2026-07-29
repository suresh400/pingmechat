import React, { useState, useEffect, useRef } from "react";
import {
  Box, Stack, Typography, TextField, Button, IconButton,
  Alert, CircularProgress, Link, Avatar, Select, MenuItem
} from "@mui/material";
import { ChatCircleDots, X, CheckCircle, XCircle, Camera, UploadSimple } from "phosphor-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE } from "../constants";
import "./AuthModal.css";

const COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+1", country: "United States / Canada", flag: "🇺🇸" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+52", country: "Mexico", flag: "🇲🇽" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+977", country: "Nepal", flag: "🇳🇵" },
  { code: "+880", country: "Bangladesh", flag: "🇧🇩" },
  { code: "+92", country: "Pakistan", flag: "🇵🇰" },
  { code: "+94", country: "Sri Lanka", flag: "🇱🇱" },
  { code: "+62", country: "Indonesia", flag: "🇮🇩" },
  { code: "+60", country: "Malaysia", flag: "🇲🇾" },
  { code: "+63", country: "Philippines", flag: "🇵🇭" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
];

export default function AuthModal({ open, onClose, initialMode = "login" }) {
  const navigate = useNavigate();
  const { sendOtp, verifyOtp, authFetch, updateCurrentUser, wakeupBackend } = useAuth();
  const fileInputRef = useRef(null);

  // Flow control steps: "phone" | "otp" | "existing_user" | "new_user_step1" | "new_user_step2"
  const [step, setStep] = useState("phone");

  const [countryCode, setCountryCode] = useState("+91");
  const [subscriberNumber, setSubscriberNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [retryStatus, setRetryStatus] = useState(""); // shown during backend cold-start retries
  const [userCount, setUserCount] = useState(null);

  // OTP countdown timer — 5 minutes (300 seconds), matches Supabase OTP TTL
  const OTP_TTL = 300;
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(OTP_TTL);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds before resend is allowed
  const timerRef = useRef(null);
  const resendTimerRef = useRef(null);

  // Profile data for existing / new users
  const [existingUserData, setExistingUserData] = useState(null);
  const [newUsername, setNewUsername] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Fetch active users count
  useEffect(() => {
    if (!open) return;
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
    const interval = setInterval(fetchUserCount, 10000);
    return () => clearInterval(interval);
  }, [open]);

  // Pre-warm the Render backend as soon as the modal opens
  useEffect(() => {
    if (!open) return;
    if (wakeupBackend) {
      wakeupBackend((msg) => console.log("[modal pre-warm]", msg))
        .then(() => console.log("[modal pre-warm] Backend ready"))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset modal state when opened/closed
  useEffect(() => {
    if (!open) {
      setCountryCode("+91");
      setSubscriberNumber("");
      setPhone("");
      setOtp("");
      setStep("phone");
      setError("");
      setSuccess("");
      setRetryStatus("");
      setLoading(false);
      setExistingUserData(null);
      setNewUsername("");
      setUsernameAvailable(null);
      setAvatarUrl("");
      setUploadingAvatar(false);
      clearInterval(timerRef.current);
      clearInterval(resendTimerRef.current);
    }
  }, [open]);

  // Start 5-min countdown when OTP step begins
  useEffect(() => {
    if (step !== "otp") {
      clearInterval(timerRef.current);
      return;
    }
    setOtpSecondsLeft(OTP_TTL);
    setOtpExpired(false);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setOtpExpired(true);
          setOtp("");
          setError("Your verification code has expired. Please request a new one.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Debounced check for username availability in database
  useEffect(() => {
    if (step !== "new_user_step1") return;
    const trimmed = newUsername.trim();
    if (!trimmed || trimmed.length < 3) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setUsernameAvailable(data.available === true);
      } catch (err) {
        console.error("Check username failed:", err);
        setUsernameAvailable(false);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [newUsername, step]);

  const startResendCooldown = () => {
    setResendCooldown(30);
    clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");

    // Robust E.164 phone normalization for any number
    let digits = subscriberNumber.replace(/\D/g, "").replace(/^0+/, "");
    const ccDigits = countryCode.replace(/\D/g, "");
    if (digits.startsWith(ccDigits) && digits.length > 10) {
      digits = digits.slice(ccDigits.length);
    }

    if (!digits || digits.length < 6) {
      setError("Please enter a valid mobile number.");
      return;
    }

    // Format strictly as E.164: +[country_code][number]
    const fullPhone = `${countryCode}${digits}`;
    setPhone(fullPhone);

    setLoading(true);
    try {
      await sendOtp(fullPhone, (msg) => setRetryStatus(msg));
      setRetryStatus("");
      setStep("otp");
      setSuccess(`A 6-digit verification code has been sent to ${fullPhone}. It expires in 5 minutes.`);
      startResendCooldown();
    } catch (err) {
      console.error("Failed to send OTP:", err);
      let errMsg = err.message || "Failed to send verification code.";
      if (errMsg.toLowerCase().includes("sms provider") || errMsg.toLowerCase().includes("provider")) {
        errMsg = "SMS Provider error. Please check Supabase Phone Auth settings or test mode.";
      } else if (errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("too many")) {
        errMsg = "Too many SMS requests sent to this number. Please wait a few minutes before trying again.";
      } else if (errMsg.toLowerCase().includes("invalid phone")) {
        errMsg = "Invalid phone number format. Please check your country code and number.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setSuccess("");
    setOtp("");
    setOtpExpired(false);
    setLoading(true);
    try {
      await sendOtp(phone, (msg) => setRetryStatus(msg));
      setRetryStatus("");
      setSuccess(`A new 6-digit code has been sent to ${phone}. It expires in 5 minutes.`);
      startResendCooldown();
      // Restart the 5-min countdown
      setOtpSecondsLeft(OTP_TTL);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setOtpSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setOtpExpired(true);
            setOtp("");
            setError("Your verification code has expired. Please request a new one.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Failed to resend OTP:", err);
      setError(err.message || "Failed to resend code. Please try again.");
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
      const resData = await verifyOtp(phone, otp, (statusMsg) => {
        setRetryStatus(statusMsg);
      });
      setRetryStatus("");
      setLoading(false);

      if (resData.isNewUser) {
        // New user -> 2-Step Onboarding Process
        setAvatarUrl(resData.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`);
        setStep("new_user_step1");
      } else {
        // Existing user -> Show profile card with username & image
        setExistingUserData(resData.user);
        setStep("existing_user");
      }
    } catch (err) {
      console.error("[handleVerifyCode] Error:", err);
      setRetryStatus("");
      setLoading(false);
      let errMsg = err.message || "Invalid or expired verification code.";
      if (errMsg.toLowerCase().includes("expired") || errMsg.toLowerCase().includes("invalid") || (errMsg.toLowerCase().includes("otp") && !errMsg.toLowerCase().includes("server"))) {
        errMsg = "Verification code has expired or is invalid. Please click 'Resend Code' to get a new 6-digit code.";
      }
      setError(errMsg);
    }
  };

  const handleProceedExistingUser = () => {
    onClose();
    navigate("/app");
  };

  // Step 1: Submit Username
  const handleNextToStep2 = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !usernameAvailable || checkingUsername) return;

    setError("");
    setLoading(true);
    try {
      // Update username on backend
      const res = await authFetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to set username.");

      if (updateCurrentUser) {
        updateCurrentUser({ username: data.user.username });
      }
      setStep("new_user_step2");
    } catch (err) {
      setError(err.message || "Failed to update username.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Upload Avatar Image
  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await authFetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) throw new Error(uploadData.message || "Image upload failed.");

      const newAvatarUrl = uploadData.url;
      setAvatarUrl(newAvatarUrl);

      // Save avatar to profile on server
      await authFetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        body: JSON.stringify({ avatar: newAvatarUrl }),
      });
      if (updateCurrentUser) {
        updateCurrentUser({ avatar: newAvatarUrl });
      }
    } catch (err) {
      setError(err.message || "Failed to upload image.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFinishOnboarding = () => {
    onClose();
    navigate("/app");
  };

  const handleBackToPhone = () => {
    setOtp("");
    setStep("phone");
    setError("");
    setSuccess("");
  };

  return (
    <div className={`auth-modal-overlay ${open ? "open" : ""}`} onClick={onClose}>
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: 460,
          maxWidth: "92vw",
          position: "relative",
          borderRadius: "24px",
          background: "rgba(15, 15, 15, 0.92)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 30px 70px rgba(0, 0, 0, 0.85)",
          p: "40px 32px",
          boxSizing: "border-box",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Close Button */}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: "absolute", top: 16, right: 16, color: "rgba(255, 255, 255, 0.5)", "&:hover": { color: "#fff" } }}
        >
          <X size={20} />
        </IconButton>

        {/* Header Logo */}
        <Stack alignItems="center" spacing={1} mb={3} mt={1}>
          <Box
            sx={{
              width: 50, height: 50, borderRadius: "14px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ChatCircleDots size={26} color="#fff" weight="fill" />
          </Box>
          <Typography variant="h5" component="p" fontWeight={900} sx={{ color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" }}>PingsMe</Typography>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }}>{success}</Alert>}

        {/* ── STEP 1: PHONE NUMBER WITH COUNTRY CODE SELECTOR ── */}
        {step === "phone" && (
          <form onSubmit={handleSendCode}>
            <Stack spacing={2.5}>
              <Typography variant="body2" align="center" sx={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 13.5, fontWeight: 500 }}>
                Enter your mobile number to receive a 6-digit verification code
              </Typography>

              {/* Unified Luxury Input Box */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  bgcolor: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  borderRadius: "16px",
                  p: 0.6,
                  transition: "all 0.25s ease",
                  "&:hover": {
                    borderColor: "rgba(255, 255, 255, 0.35)",
                    bgcolor: "rgba(255, 255, 255, 0.06)",
                  },
                  "&:focus-within": {
                    borderColor: "#3b82f6",
                    boxShadow: "0 0 16px rgba(59, 130, 246, 0.3)",
                    bgcolor: "rgba(255, 255, 255, 0.07)",
                  },
                }}
              >
                {/* Country Code Dropdown */}
                <Select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  variant="standard"
                  disableUnderline
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: "#161618",
                        color: "#fff",
                        maxHeight: 280,
                        borderRadius: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
                        "& .MuiMenuItem-root": {
                          fontSize: 14,
                          py: 1.2,
                          px: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.08)" },
                          "&.Mui-selected": { bgcolor: "rgba(59, 130, 246, 0.2)", fontWeight: 700 }
                        }
                      }
                    }
                  }}
                  sx={{
                    minWidth: 105,
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    pl: 1.5,
                    pr: 0.5,
                    py: 0.8,
                    borderRight: "1px solid rgba(255, 255, 255, 0.12)",
                    "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.7)" },
                    "& .MuiSelect-select": {
                      display: "flex",
                      alignItems: "center",
                      gap: 1
                    }
                  }}
                >
                  {COUNTRY_CODES.map((c) => (
                    <MenuItem key={`${c.code}-${c.country}`} value={c.code}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <span style={{ fontSize: 18 }}>{c.flag}</span>
                        <span>{c.code}</span>
                      </Box>
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", ml: 2 }}>
                        {c.country}
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>

                {/* Subscriber Phone Input */}
                <TextField
                  name="subscriberNumber"
                  type="tel"
                  fullWidth
                  required
                  placeholder="98765 43210"
                  value={subscriberNumber}
                  onChange={(e) => setSubscriberNumber(e.target.value)}
                  variant="standard"
                  InputProps={{ disableUnderline: true }}
                  onFocus={() => {
                    if (wakeupBackend) wakeupBackend().catch(() => {});
                  }}
                  sx={{
                    px: 2,
                    "& .MuiInputBase-input": {
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: 0.5,
                      py: 0.8,
                      "&::placeholder": { color: "rgba(255,255,255,0.25)", opacity: 1 }
                    },
                  }}
                />
              </Box>

              {/* Real-time Formatted Number Preview Badge */}
              {subscriberNumber.trim().length > 0 && (() => {
                let digits = subscriberNumber.replace(/\D/g, "").replace(/^0+/, "");
                const ccDigits = countryCode.replace(/\D/g, "");
                if (digits.startsWith(ccDigits) && digits.length > 10) digits = digits.slice(ccDigits.length);
                const selectedObj = COUNTRY_CODES.find(c => c.code === countryCode) || { flag: "📱" };
                return (
                  <Box sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    bgcolor: "rgba(59, 130, 246, 0.08)",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                    borderRadius: "10px",
                    px: 2, py: 0.8
                  }}>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Full Mobile Number:
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#60a5fa", fontWeight: 700, fontFamily: "monospace", fontSize: 13 }}>
                      {selectedObj.flag} {countryCode} {digits}
                    </Typography>
                  </Box>
                );
              })()}

              {/* Server warm-up banner (shown while pinging Render) */}
              {retryStatus && (
                <Box sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  bgcolor: "rgba(255, 165, 0, 0.08)",
                  border: "1px solid rgba(255, 165, 0, 0.25)",
                  borderRadius: "10px", px: 2, py: 1.2,
                }}>
                  <CircularProgress size={14} sx={{ color: "#FF9800", flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ color: "#FF9800", fontWeight: 600, lineHeight: 1.4 }}>
                    {retryStatus}
                  </Typography>
                </Box>
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading || !subscriberNumber.replace(/\D/g, "")}
                sx={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  color: "#fff",
                  borderRadius: "50px",
                  py: 1.3,
                  fontWeight: 800,
                  textTransform: "none",
                  fontSize: 15,
                  boxShadow: "0 8px 24px rgba(37, 99, 235, 0.35)",
                  transition: "all 0.25s ease",
                  "&:hover": {
                    background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
                    boxShadow: "0 12px 28px rgba(37, 99, 235, 0.5)",
                    transform: "translateY(-1px)"
                  },
                  "&.Mui-disabled": {
                    background: "rgba(255, 255, 255, 0.12)",
                    color: "rgba(255,255,255,0.4)",
                    boxShadow: "none"
                  }
                }}
              >
                {loading
                  ? <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} color="inherit" />
                      <span>{retryStatus ? "Connecting…" : "Sending OTP…"}</span>
                    </Stack>
                  : "Send OTP Code"}
              </Button>
            </Stack>
          </form>
        )}



        {/* ── STEP 2: OTP VERIFICATION ── */}
        {step === "otp" && (() => {
          const pct = otpSecondsLeft / OTP_TTL; // 1.0 → 0.0
          const mins = String(Math.floor(otpSecondsLeft / 60)).padStart(2, "0");
          const secs = String(otpSecondsLeft % 60).padStart(2, "0");
          const timerColor = otpSecondsLeft > 60 ? "#4CAF50" : otpSecondsLeft > 20 ? "#FF9800" : "#F44336";
          const radius = 22;
          const circ = 2 * Math.PI * radius;
          return (
            <form onSubmit={handleVerifyCode}>
              <Stack spacing={2.5}>
                <Typography variant="body2" align="center" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                  Enter the 6-digit code sent to <strong style={{ color: "#fff" }}>{phone}</strong>
                </Typography>

                {/* Countdown ring + timer */}
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                    <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                      <circle
                        cx="28" cy="28" r={radius} fill="none"
                        stroke={otpExpired ? "#F44336" : timerColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={circ * (1 - pct)}
                        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
                      />
                    </svg>
                    <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: otpExpired ? "#F44336" : timerColor, fontFamily: "monospace", lineHeight: 1 }}>
                        {otpExpired ? "EXP" : `${mins}:${secs}`}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: otpExpired ? "#F44336" : "rgba(255,255,255,0.5)", fontWeight: 600, lineHeight: 1.4 }}>
                    {otpExpired
                      ? "Code expired. Request a new one below."
                      : `Code expires in ${mins}:${secs}. Enter it before the timer runs out.`}
                  </Typography>
                </Box>

                <TextField
                  label="6-Digit OTP Code"
                  name="otp"
                  fullWidth
                  required
                  placeholder="123456"
                  value={otp}
                  disabled={otpExpired}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  variant="outlined"
                  size="small"
                  sx={{
                    "& .MuiInputBase-input": { color: "#fff", letterSpacing: 4, textAlign: "center", fontSize: 18, fontWeight: 700 },
                    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
                    "& .MuiInputLabel-root.Mui-focused": { color: "#fff" },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: otpExpired ? "rgba(244,67,54,0.4)" : "rgba(255, 255, 255, 0.15)" },
                      "&:hover fieldset": { borderColor: otpExpired ? "rgba(244,67,54,0.6)" : "rgba(255, 255, 255, 0.3)" },
                      "&.Mui-focused fieldset": { borderColor: "#fff" },
                    },
                  }}
                />

                {/* Server warm-up / retry status banner */}
                {retryStatus && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      bgcolor: "rgba(255, 165, 0, 0.08)",
                      border: "1px solid rgba(255, 165, 0, 0.25)",
                      borderRadius: "10px",
                      px: 2,
                      py: 1.2,
                    }}
                  >
                    <CircularProgress size={14} sx={{ color: "#FF9800", flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: "#FF9800", fontWeight: 600, lineHeight: 1.4 }}>
                      {retryStatus}
                    </Typography>
                  </Box>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || otp.length !== 6 || otpExpired}
                  sx={{
                    backgroundColor: "#fff",
                    color: "#000",
                    borderRadius: 50,
                    py: 1.2,
                    fontWeight: 800,
                    textTransform: "none",
                    fontSize: 15,
                    "&:hover": { backgroundColor: "#e5e5e5" },
                    "&.Mui-disabled": { backgroundColor: "rgba(255, 255, 255, 0.3)", color: "rgba(0,0,0,0.5)" }
                  }}
                >
                  {loading
                    ? <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={18} color="inherit" />
                        <span>{retryStatus ? "Connecting…" : "Verifying…"}</span>
                      </Stack>
                    : "Verify & Continue"}
                </Button>


                <Stack direction="row" justifyContent="space-between" mt={0.5}>
                  <Box>
                    <Link
                      component="button"
                      type="button"
                      onClick={handleResendCode}
                      disabled={loading || resendCooldown > 0}
                      sx={{
                        color: resendCooldown > 0 ? "rgba(255,255,255,0.3)" : "#3B82F6",
                        fontWeight: 700, fontSize: 13, textDecoration: "none",
                        cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                        "&:hover": { textDecoration: resendCooldown > 0 ? "none" : "underline" }
                      }}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                    </Link>
                  </Box>
                  <Link
                    component="button"
                    type="button"
                    onClick={handleBackToPhone}
                    sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer", "&:hover": { color: "#fff" } }}
                  >
                    Change Number
                  </Link>
                </Stack>
              </Stack>
            </form>
          );
        })()}

        {/* ── STEP 3: EXISTING USER CARD ── */}
        {step === "existing_user" && existingUserData && (
          <Stack spacing={3} alignItems="center" textAlign="center" py={1}>
            <Typography variant="h6" fontWeight={800} sx={{ color: "#fff" }}>
              Welcome Back! 👋
            </Typography>

            <Box sx={{ position: "relative" }}>
              <Avatar
                src={existingUserData.avatar}
                alt={existingUserData.username}
                sx={{
                  width: 90, height: 90,
                  border: "3px solid #3B82F6",
                  boxShadow: "0 0 20px rgba(59, 130, 246, 0.4)",
                  fontSize: 32,
                  bgcolor: "#222"
                }}
              >
                {existingUserData.username ? existingUserData.username.charAt(0).toUpperCase() : "U"}
              </Avatar>
            </Box>

            <Stack spacing={0.5}>
              <Typography variant="h6" fontWeight={900} sx={{ color: "#fff" }}>
                {existingUserData.username}
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.5)" }}>
                Verified Account ({phone})
              </Typography>
            </Stack>

            <Button
              variant="contained"
              fullWidth
              onClick={handleProceedExistingUser}
              sx={{
                backgroundColor: "#fff",
                color: "#000",
                borderRadius: 50,
                py: 1.2,
                fontWeight: 800,
                textTransform: "none",
                fontSize: 15,
                "&:hover": { backgroundColor: "#e5e5e5" },
              }}
            >
              Continue to Dashboard
            </Button>
          </Stack>
        )}

        {/* ── NEW USER STEP 1 OF 2: CHOOSE UNIQUE USERNAME ── */}
        {step === "new_user_step1" && (
          <form onSubmit={handleNextToStep2}>
            <Stack spacing={2.5}>
              <Box textAlign="center">
                <Typography variant="body2" fontWeight={700} sx={{ color: "#3B82F6", textTransform: "uppercase", letterSpacing: 1, fontSize: 12 }}>
                  Step 1 of 2
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ color: "#fff", mt: 0.5 }}>
                  Choose Your Username
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.5)" }}>
                  Create a unique handle for your PingsMe account
                </Typography>
              </Box>

              <Box>
                <TextField
                  label="Unique Username"
                  name="newUsername"
                  fullWidth
                  required
                  placeholder="e.g. alex_pingsme"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ""))}
                  variant="outlined"
                  size="small"
                  sx={{
                    "& .MuiInputBase-input": { color: "#fff", fontWeight: 600 },
                    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
                    "& .MuiInputLabel-root.Mui-focused": { color: "#fff" },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                      "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                      "&.Mui-focused fieldset": { borderColor: "#fff" },
                    },
                  }}
                />

                {/* Real-time Unique Username verification feedback */}
                <Box sx={{ mt: 1, minHeight: 24, display: "flex", alignItems: "center" }}>
                  {checkingUsername && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={14} sx={{ color: "#3B82F6" }} />
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                        Verifying username in database...
                      </Typography>
                    </Stack>
                  )}
                  {!checkingUsername && usernameAvailable === true && (
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <CheckCircle size={16} color="#4CAF50" weight="fill" />
                      <Typography variant="caption" sx={{ color: "#4CAF50", fontWeight: 700 }}>
                        Username is unique and available!
                      </Typography>
                    </Stack>
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <XCircle size={16} color="#F44336" weight="fill" />
                      <Typography variant="caption" sx={{ color: "#F44336", fontWeight: 700 }}>
                        Username is already taken. Please choose another.
                      </Typography>
                    </Stack>
                  )}
                  {!checkingUsername && usernameAvailable === null && newUsername.trim().length > 0 && newUsername.trim().length < 3 && (
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                      Must be at least 3 characters long
                    </Typography>
                  )}
                </Box>
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading || !usernameAvailable || checkingUsername}
                sx={{
                  backgroundColor: "#fff",
                  color: "#000",
                  borderRadius: 50,
                  py: 1.2,
                  fontWeight: 800,
                  textTransform: "none",
                  fontSize: 15,
                  "&:hover": { backgroundColor: "#e5e5e5" },
                  "&.Mui-disabled": { backgroundColor: "rgba(255, 255, 255, 0.3)", color: "rgba(0,0,0,0.5)" }
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Next: Add Profile Picture"}
              </Button>
            </Stack>
          </form>
        )}

        {/* ── NEW USER STEP 2 OF 2: UPLOAD PROFILE IMAGE ── */}
        {step === "new_user_step2" && (
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Box textAlign="center">
              <Typography variant="body2" fontWeight={700} sx={{ color: "#3B82F6", textTransform: "uppercase", letterSpacing: 1, fontSize: 12 }}>
                Step 2 of 2
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: "#fff", mt: 0.5 }}>
                Upload Profile Picture
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.5)" }}>
                Personalize your avatar for {newUsername}
              </Typography>
            </Box>

            <Box sx={{ position: "relative", cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
              <Avatar
                src={avatarUrl}
                alt={newUsername}
                sx={{
                  width: 100, height: 100,
                  border: "3px dashed rgba(255, 255, 255, 0.3)",
                  transition: "all 0.2s",
                  "&:hover": { border: "3px solid #3B82F6", opacity: 0.9 },
                  bgcolor: "#222"
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  bottom: 2, right: 2,
                  bgcolor: "#3B82F6",
                  borderRadius: "50%",
                  p: 0.8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                }}
              >
                <Camera size={16} color="#fff" weight="bold" />
              </Box>

              {uploadingAvatar && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    bgcolor: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <CircularProgress size={28} sx={{ color: "#fff" }} />
                </Box>
              )}
            </Box>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarFileSelect}
            />

            <Button
              variant="outlined"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              startIcon={<UploadSimple size={16} />}
              sx={{
                color: "#fff",
                borderColor: "rgba(255,255,255,0.2)",
                borderRadius: 50,
                textTransform: "none",
                fontSize: 13,
                "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.05)" }
              }}
            >
              {avatarUrl && !avatarUrl.includes("dicebear") ? "Change Selected Photo" : "Upload Custom Image"}
            </Button>

            <Button
              variant="contained"
              fullWidth
              onClick={handleFinishOnboarding}
              disabled={uploadingAvatar}
              sx={{
                backgroundColor: "#fff",
                color: "#000",
                borderRadius: 50,
                py: 1.2,
                fontWeight: 800,
                textTransform: "none",
                fontSize: 15,
                "&:hover": { backgroundColor: "#e5e5e5" },
              }}
            >
              Finish & Start Chatting
            </Button>
          </Stack>
        )}

        {/* Active users display */}
        {userCount !== null && (
          <Box sx={{ mt: 3.5, display: "flex", justifyContent: "center" }}>
            <Box sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1.2,
              bgcolor: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "20px",
              px: 2,
              py: 0.6,
            }}>
              <Box sx={{
                width: 7, height: 7, borderRadius: "50%", bgcolor: "#4CAF50",
                animation: "pulse 1.8s infinite",
                "@keyframes pulse": {
                  "0%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(76, 175, 80, 0.7)" },
                  "70%": { transform: "scale(1)", boxShadow: "0 0 0 6px rgba(76, 175, 80, 0)" },
                  "100%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(76, 175, 80, 0)" }
                }
              }} />
              <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.6)", fontWeight: 600, fontSize: 11 }}>
                Active Users: <span style={{ color: "#fff", fontWeight: 800 }}>{userCount}</span>
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </div>
  );
}
