import React, { useState, useEffect } from "react";
import {
  Box, Stack, Typography, TextField, Button, IconButton,
  InputAdornment, Alert, Link, CircularProgress
} from "@mui/material";
import { Eye, EyeSlash, ChatCircleDots, CheckCircle, XCircle, X } from "phosphor-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE } from "../constants";
import "./AuthModal.css";

export default function AuthModal({ open, onClose, initialMode = "login" }) {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  // Mode: "login" or "register"
  const [mode, setMode] = useState(initialMode);

  // Transition synchronization when modal is opened
  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  // LOGIN STATE
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [userCount, setUserCount] = useState(null);

  // REGISTER STATE
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [showRegPw, setShowRegPw] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  
  // OTP Verification
  const [otpRequired, setOtpRequired] = useState(false);
  const [otp, setOtp] = useState("");
  
  // Live username check
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken'

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
    const interval = setInterval(fetchUserCount, 5000);
    return () => clearInterval(interval);
  }, [open]);

  // Live username check effect
  useEffect(() => {
    if (otpRequired || !registerForm.username.trim() || registerForm.username.length < 3) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/check-username?username=${encodeURIComponent(registerForm.username)}`);
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [registerForm.username, otpRequired]);

  // Reset inputs when modal is closed
  useEffect(() => {
    if (!open) {
      setLoginForm({ email: "", password: "" });
      setRegisterForm({ username: "", email: "", password: "", confirm: "" });
      setOtp("");
      setOtpRequired(false);
      setLoginError("");
      setRegError("");
      setRegSuccess("");
      setUsernameStatus(null);
    }
  }, [open]);

  // HANDLERS
  const handleLoginChange = (e) => setLoginForm({ ...loginForm, [e.target.name]: e.target.value });
  const handleRegisterChange = (e) => setRegisterForm({ ...registerForm, [e.target.name]: e.target.value });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      onClose();
      navigate("/app");
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");
    
    if (!otpRequired) {
      if (usernameStatus === "taken") {
        setRegError("Username is already taken.");
        return;
      }
      if (registerForm.password !== registerForm.confirm) {
        setRegError("Passwords do not match.");
        return;
      }
      if (registerForm.password.length < 8) {
        setRegError("Password must be at least 8 characters.");
        return;
      }
    } else {
      if (otp.length !== 6) {
        setRegError("Please enter a valid 6-digit verification code.");
        return;
      }
    }

    setRegLoading(true);
    try {
      const res = await register(
        registerForm.username,
        registerForm.email,
        registerForm.password,
        otpRequired ? otp : undefined
      );
      if (res && res.otpRequired) {
        setOtpRequired(true);
        setRegSuccess(res.message);
      } else {
        onClose();
        navigate("/app");
      }
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setRegError("");
    setRegSuccess("");
    setRegLoading(true);
    try {
      const res = await register(registerForm.username, registerForm.email, registerForm.password);
      if (res && res.otpRequired) {
        setRegSuccess("Verification code resent successfully.");
      }
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const usernameAdornment = () => {
    if (usernameStatus === "checking") return <CircularProgress size={16} />;
    if (usernameStatus === "available") return <CheckCircle size={18} color="#4CAF50" weight="fill" />;
    if (usernameStatus === "taken") return <XCircle size={18} color="#F44336" weight="fill" />;
    return null;
  };

  return (
    <div className={`auth-modal-overlay ${open ? "open" : ""}`} onClick={onClose}>
      <div
        className={`flip-card-container ${otpRequired && mode === "register" ? "tall" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flip-card-inner ${mode === "register" ? "flipped" : ""}`}>
          
          {/* FRONT CARD: LOGIN */}
          <div className="flip-card-front" style={{ padding: "40px 32px" }}>
            {/* Close Button */}
            <IconButton
              onClick={onClose}
              sx={{ position: "absolute", top: 16, right: 16, color: "rgba(255, 255, 255, 0.5)", "&:hover": { color: "#fff" } }}
            >
              <X size={20} />
            </IconButton>

            {/* Logo & Header */}
            <Stack alignItems="center" spacing={1} mb={4} mt={1}>
              <Box
                sx={{
                  width: 50, height: 50, borderRadius: 2,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <ChatCircleDots size={26} color="#fff" weight="fill" />
              </Box>
              <Typography variant="h5" fontWeight={900} sx={{ color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" }}>PingsMe</Typography>
              <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.5)" }}>Sign in to continue chatting</Typography>
            </Stack>

            {loginError && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{loginError}</Alert>}

            <form onSubmit={handleLoginSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  label="Email address"
                  name="email"
                  type="email"
                  fullWidth
                  required
                  value={loginForm.email}
                  onChange={handleLoginChange}
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
                <TextField
                  label="Password"
                  name="password"
                  type={showLoginPw ? "text" : "password"}
                  fullWidth
                  required
                  value={loginForm.password}
                  onChange={handleLoginChange}
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
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowLoginPw(!showLoginPw)} edge="end" size="small" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                          {showLoginPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loginLoading}
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
                  {loginLoading ? <CircularProgress size={22} color="inherit" /> : "Sign In"}
                </Button>
              </Stack>
            </form>

            <Stack direction="row" alignItems="center" justifyContent="flex-end" mt={1.5} mb={0.5}>
              <Link
                component="button"
                onClick={() => {
                  onClose();
                  navigate("/forgot-password");
                }}
                sx={{ color: "rgba(255, 255, 255, 0.5)", fontWeight: 600, fontSize: 13, cursor: "pointer", textDecoration: "none", "&:hover": { color: "#fff", textDecoration: "underline" } }}
              >
                Forgot Password?
              </Link>
            </Stack>

            <Typography variant="body2" align="center" sx={{ mt: 3, color: "rgba(255,255,255,0.5)" }}>
              Don't have an account?{" "}
              <Link
                component="button"
                onClick={() => setMode("register")}
                sx={{ color: "#fff", fontWeight: 800, cursor: "pointer", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                Register
              </Link>
            </Typography>

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
          </div>

          {/* BACK CARD: REGISTER */}
          <div className="flip-card-back" style={{ padding: "40px 32px" }}>
            {/* Close Button */}
            <IconButton
              onClick={onClose}
              sx={{ position: "absolute", top: 16, right: 16, color: "rgba(255, 255, 255, 0.5)", "&:hover": { color: "#fff" } }}
            >
              <X size={20} />
            </IconButton>

            {/* Logo & Header */}
            <Stack alignItems="center" spacing={1} mb={3.5} mt={1}>
              <Box
                sx={{
                  width: 50, height: 50, borderRadius: 2,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <ChatCircleDots size={26} color="#fff" weight="fill" />
              </Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: "#fff" }}>Create account</Typography>
              <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.5)" }}>Join PingMe — chat, connect, belong</Typography>
            </Stack>

            {regSuccess && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{regSuccess}</Alert>}
            {regError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{regError}</Alert>}

            <form onSubmit={handleRegisterSubmit}>
              <Stack spacing={2.2}>
                {!otpRequired ? (
                  <>
                    <TextField
                      label="Username"
                      name="username"
                      fullWidth
                      required
                      value={registerForm.username}
                      onChange={handleRegisterChange}
                      variant="outlined"
                      size="small"
                      error={usernameStatus === "taken"}
                      helperText={usernameStatus === "taken" ? "Username already taken" : usernameStatus === "available" ? "✓ Username available" : ""}
                      FormHelperTextProps={{ sx: { color: usernameStatus === "available" ? "#4CAF50" : "error.main", fontWeight: 600, mt: 0.5 } }}
                      InputProps={{ endAdornment: <InputAdornment position="end" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>{usernameAdornment()}</InputAdornment> }}
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
                    <TextField
                      label="Email address"
                      name="email"
                      type="email"
                      fullWidth
                      required
                      value={registerForm.email}
                      onChange={handleRegisterChange}
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
                    <TextField
                      label="Password"
                      name="password"
                      type={showRegPw ? "text" : "password"}
                      fullWidth
                      required
                      value={registerForm.password}
                      onChange={handleRegisterChange}
                      variant="outlined"
                      size="small"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowRegPw(!showRegPw)} edge="end" size="small" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                              {showRegPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
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
                    <TextField
                      label="Confirm Password"
                      name="confirm"
                      type="password"
                      fullWidth
                      required
                      value={registerForm.confirm}
                      onChange={handleRegisterChange}
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
                      disabled={regLoading || usernameStatus === "taken" || usernameStatus === "checking"}
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
                      {regLoading ? <CircularProgress size={22} color="inherit" /> : "Create Account"}
                    </Button>
                  </>
                ) : (
                  <>
                    <TextField
                      label="6-Digit Verification Code"
                      name="otp"
                      fullWidth
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      variant="outlined"
                      size="small"
                      placeholder="123456"
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
                      disabled={regLoading || otp.length !== 6}
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
                      {regLoading ? <CircularProgress size={22} color="inherit" /> : "Verify & Create Account"}
                    </Button>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                      <Link
                        component="button"
                        type="button"
                        onClick={handleResendOtp}
                        disabled={regLoading}
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
                          setRegError("");
                          setRegSuccess("");
                        }}
                        sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer", "&:hover": { color: "#fff" } }}
                      >
                        Edit Details
                      </Link>
                    </Stack>
                  </>
                )}
              </Stack>
            </form>

            <Typography variant="body2" align="center" sx={{ mt: 3, color: "rgba(255,255,255,0.5)" }}>
              Already have an account?{" "}
              <Link
                component="button"
                type="button"
                onClick={() => setMode("login")}
                sx={{ color: "#fff", fontWeight: 800, cursor: "pointer", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                Sign In
              </Link>
            </Typography>

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
          </div>

        </div>
      </div>
    </div>
  );
}
