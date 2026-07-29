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
  const { sendOtp, verifyOtp, authFetch, updateCurrentUser } = useAuth();
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
  const [userCount, setUserCount] = useState(null);

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
      setLoading(false);
      setExistingUserData(null);
      setNewUsername("");
      setUsernameAvailable(null);
      setAvatarUrl("");
      setUploadingAvatar(false);
    }
  }, [open]);

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

  const handleSendCode = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");

    // Strip non-digit characters from subscriber number
    const cleanDigits = subscriberNumber.replace(/\D/g, "");
    if (!cleanDigits) {
      setError("Please enter a valid mobile number.");
      return;
    }

    if (cleanDigits.length < 6) {
      setError("Phone number is too short. Please enter a valid number.");
      return;
    }

    // Format strictly as E.164: +[country_code][number]
    const fullPhone = `${countryCode}${cleanDigits}`;
    setPhone(fullPhone);

    setLoading(true);
    try {
      await sendOtp(fullPhone);
      setStep("otp");
      setSuccess(`A 6-digit verification code has been sent to ${fullPhone}.`);
    } catch (err) {
      console.error("Failed to send OTP:", err);
      let errMsg = err.message || "Failed to send verification code.";
      if (errMsg.toLowerCase().includes("sms provider") || errMsg.toLowerCase().includes("provider")) {
        errMsg = "SMS Provider error. If using Supabase, please verify that Phone Auth and Twilio/SMS provider settings are configured in the Supabase Dashboard.";
      }
      setError(errMsg);
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
      const resData = await verifyOtp(phone, otp);
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
      setLoading(false);
      let errMsg = err.message || "Invalid or expired verification code.";
      if (errMsg.includes("Failed to fetch") || errMsg.includes("Unable to connect")) {
        errMsg = "Unable to connect to authentication server. Please check your internet connection or try again in a few seconds.";
      } else if (errMsg.toLowerCase().includes("expired") || errMsg.toLowerCase().includes("invalid") || errMsg.toLowerCase().includes("otp")) {
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
              <Typography variant="body2" align="center" sx={{ color: "rgba(255, 255, 255, 0.6)", mb: 0.5 }}>
                Sign in or Register with Phone Number
              </Typography>

              <Stack direction="row" spacing={1.5} alignItems="center">
                {/* Country Code Dropdown Menu with Flags */}
                <Select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  size="small"
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: "#141414",
                        color: "#fff",
                        maxHeight: 280,
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        "& .MuiMenuItem-root": {
                          fontSize: 14,
                          py: 1,
                          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.08)" },
                          "&.Mui-selected": { bgcolor: "rgba(255, 255, 255, 0.15)" }
                        }
                      }
                    }
                  }}
                  sx={{
                    minWidth: 120,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    bgcolor: "rgba(255, 255, 255, 0.03)",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255, 255, 255, 0.15)" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255, 255, 255, 0.3)" },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#fff" },
                    "& .MuiSvgIcon-root": { color: "#fff" }
                  }}
                >
                  {COUNTRY_CODES.map((c) => (
                    <MenuItem key={`${c.code}-${c.country}`} value={c.code}>
                      <span style={{ marginRight: 8, fontSize: 16 }}>{c.flag}</span>
                      <span>{c.code}</span>
                    </MenuItem>
                  ))}
                </Select>

                {/* Subscriber Phone Input */}
                <TextField
                  label="Mobile Number"
                  name="subscriberNumber"
                  type="tel"
                  fullWidth
                  required
                  placeholder="9876543210"
                  value={subscriberNumber}
                  onChange={(e) => setSubscriberNumber(e.target.value)}
                  variant="outlined"
                  size="small"
                  helperText={`Full format: ${countryCode}${subscriberNumber.replace(/\D/g, "")}`}
                  FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.4)", fontSize: 11 } }}
                  sx={{
                    "& .MuiInputBase-input": { color: "#fff", fontSize: 15, fontWeight: 600 },
                    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
                    "& .MuiInputLabel-root.Mui-focused": { color: "#fff" },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                      "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                      "&.Mui-focused fieldset": { borderColor: "#fff" },
                    },
                  }}
                />
              </Stack>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                sx={{
                  backgroundColor: "#fff",
                  color: "#000",
                  borderRadius: 50,
                  py: 1.2,
                  fontWeight: 800,
                  textTransform: "none",
                  fontSize: 15,
                  mt: 1,
                  "&:hover": { backgroundColor: "#e5e5e5" },
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Send OTP Code"}
              </Button>
            </Stack>
          </form>
        )}

        {/* ── STEP 2: OTP VERIFICATION ── */}
        {step === "otp" && (
          <form onSubmit={handleVerifyCode}>
            <Stack spacing={2.5}>
              <Typography variant="body2" align="center" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                Enter the 6-digit code sent to <strong style={{ color: "#fff" }}>{phone}</strong>
              </Typography>
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
                  "& .MuiInputBase-input": { color: "#fff", letterSpacing: 4, textAlign: "center", fontSize: 18, fontWeight: 700 },
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
                  borderRadius: 50,
                  py: 1.2,
                  fontWeight: 800,
                  textTransform: "none",
                  fontSize: 15,
                  "&:hover": { backgroundColor: "#e5e5e5" },
                  "&.Mui-disabled": { backgroundColor: "rgba(255, 255, 255, 0.3)", color: "rgba(0,0,0,0.5)" }
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Verify & Continue"}
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
                  onClick={handleBackToPhone}
                  sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer", "&:hover": { color: "#fff" } }}
                >
                  Change Phone Number
                </Link>
              </Stack>
            </Stack>
          </form>
        )}

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
