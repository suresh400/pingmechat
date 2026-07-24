import React, { useEffect } from "react";
import { Box, Stack, Avatar, Typography, IconButton, Paper, Slide } from "@mui/material";
import { X, Chat } from "phosphor-react";

export default function MessageToast({ open, title, message, avatar, onClose, onClick }) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  // Check if message is a file/link/etc to show a cleaner preview
  let displayMessage = message || "";
  if (displayMessage.startsWith("http")) {
    if (displayMessage.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)/i)) {
      displayMessage = "📷 Sent an image";
    } else if (displayMessage.match(/\.(webm|mp4|ogg)/i)) {
      displayMessage = "🎥 Sent a video";
    } else {
      displayMessage = "🔗 Sent a link";
    }
  } else if (displayMessage.includes("/uploads") || displayMessage.includes("\\uploads")) {
    displayMessage = "📁 Sent an attachment";
  }

  return (
    <Slide direction="left" in={open} mountOnEnter unmountOnExit>
      <Paper
        onClick={onClick}
        elevation={6}
        sx={{
          position: "fixed",
          top: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
          zIndex: 10000,
          width: { xs: "calc(100% - 32px)", sm: 340 },
          maxWidth: 380,
          p: 2,
          borderRadius: 3,
          cursor: "pointer",
          bgcolor: "background.paper",
          backgroundImage: "none",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.15)",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.2)"
          },
          transition: "all 0.2s ease"
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ position: "relative" }}>
          {/* Avatar / Icon */}
          <Avatar
            src={avatar}
            sx={{
              width: 44,
              height: 44,
              bgcolor: "primary.main",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}
          >
            <Chat size={22} color="#fff" />
          </Avatar>

          {/* Text Content */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ pr: 2 }}>
              {title}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ mt: 0.2, fontSize: 13 }}
            >
              {displayMessage}
            </Typography>
          </Box>

          {/* Close button */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            sx={{
              position: "absolute",
              top: -8,
              right: -8,
              color: "text.secondary",
              "&:hover": { color: "text.primary" }
            }}
          >
            <X size={16} />
          </IconButton>
        </Stack>
      </Paper>
    </Slide>
  );
}
