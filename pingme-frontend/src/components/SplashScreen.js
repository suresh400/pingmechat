import React, { useEffect, useState } from "react";
import { Box, Typography, keyframes } from "@mui/material";
import { ChatCircleDots } from "phosphor-react";

const pingZoom = keyframes`
  0% { transform: scale(0); opacity: 0; }
  30% { transform: scale(1.4); opacity: 0.7; }
  50% { transform: scale(0.9); opacity: 1; }
  70% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
`;

const ripple = keyframes`
  0% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(2.5); opacity: 0; }
`;

const fadeOut = keyframes`
  0% { opacity: 1; filter: blur(0px); }
  100% { opacity: 0; filter: blur(10px); }
`;

const SplashScreen = ({ onDone }) => {
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setLeaving(true), 1200);
        const done = setTimeout(() => onDone(), 1800);
        return () => { clearTimeout(timer); clearTimeout(done); };
    }, [onDone]);

    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                bgcolor: "#000",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                animation: leaving ? `${fadeOut} 0.6s ease forwards` : "none",
            }}
        >
            {/* Ripple Effects */}
            {!leaving && [0, 0.4, 0.8].map((delay, i) => (
                <Box
                    key={i}
                    sx={{
                        position: "absolute",
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        border: "1px solid rgba(255,255,255,0.2)",
                        animation: `${ripple} 2s cubic-bezier(0, 0, 0.2, 1) ${delay}s infinite`,
                    }}
                />
            ))}

            <Box
                sx={{
                    animation: `${pingZoom} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    zIndex: 2,
                }}
            >
                <ChatCircleDots size={80} color="#fff" weight="fill" />
            </Box>

            <Box sx={{ mt: 4, textAlign: "center", zIndex: 2 }}>
                <Typography
                    variant="h2"
                    fontWeight={900}
                    sx={{
                        color: "#fff",
                        letterSpacing: 8,
                        textTransform: "uppercase",
                        opacity: 0,
                        animation: "splashFadeIn 0.8s ease 0.6s forwards",
                        "@keyframes splashFadeIn": { "0%": { opacity: 0, transform: "translateY(10px)" }, "100%": { opacity: 1, transform: "translateY(0)" } }
                    }}
                >
                    PingMe
                </Typography>
                <Box sx={{
                    width: 40, height: 2, bgcolor: "#fff", mx: "auto", mt: 1,
                    transform: "scaleX(0)",
                    animation: "lineGrow 0.5s ease 1s forwards",
                    "@keyframes lineGrow": { "0%": { transform: "scaleX(0)" }, "100%": { transform: "scaleX(1)" } }
                }} />
            </Box>
        </Box>
    );
};

export default SplashScreen;
