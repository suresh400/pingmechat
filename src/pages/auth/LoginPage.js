import React, { useState } from "react";
import {
    Box, Stack, Typography, TextField, Button, IconButton,
    InputAdornment, Alert, Link, CircularProgress,
} from "@mui/material";
import { Eye, EyeSlash, ChatCircleDots } from "phosphor-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Threads from "./Threads";

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [form, setForm] = useState({ email: "", password: "" });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(form.email, form.password);
            navigate("/app");
        } catch (err) {
            setError(err.message);
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
                    <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>Sign in to continue chatting</Typography>
                </Stack>

                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

                <form onSubmit={handleSubmit}>
                    <Stack spacing={2.5}>
                        <TextField
                            label="Email address"
                            name="email"
                            type="email"
                            fullWidth
                            required
                            value={form.email}
                            onChange={handleChange}
                            variant="outlined"
                            size="small"
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
                            fullWidth
                            required
                            value={form.password}
                            onChange={handleChange}
                            variant="outlined"
                            size="small"
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
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowPw(!showPw)} edge="end" size="small" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                                            {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
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
                            {loading ? <CircularProgress size={22} color="inherit" /> : "Sign In"}
                        </Button>
                    </Stack>
                </form>

                <Stack direction="row" alignItems="center" justifyContent="flex-end" mt={1.5} mb={0.5}>
                    <Link
                        component="button"
                        onClick={() => navigate("/forgot-password")}
                        sx={{ color: "rgba(255, 255, 255, 0.6)", fontWeight: 600, fontSize: 13, cursor: "pointer", "&:hover": { color: "#fff" } }}
                    >
                        Forgot Password?
                    </Link>
                </Stack>

                <Typography variant="body2" align="center" sx={{ mt: 3, color: "rgba(255,255,255,0.6)" }}>
                    Don't have an account?{" "}
                    <Link
                        component="button"
                        onClick={() => navigate("/register")}
                        sx={{ color: "#fff", fontWeight: 800, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                    >
                        Register
                    </Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default LoginPage;
