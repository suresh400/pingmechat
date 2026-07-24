import React, { useEffect, useCallback, useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography, CircularProgress } from "@mui/material";
import { X, DownloadSimple } from "phosphor-react";

/**
 * ImageLightbox
 * Props:
 *   src   – image or video URL
 *   onClose – function to close
 */
export default function ImageLightbox({ src, onClose }) {
  const [downloading, setDownloading] = useState(false);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll while open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  if (!src) return null;

  const filename = src.split("/").pop().split("?")[0] || "file";
  const isVideo = src.match(/\.(webm|mp4|ogg|mov)/i) || src.includes("video");

  // Programmatic direct download to local device (bypasses opening in new tab)
  const triggerDownload = async (e) => {
    e.stopPropagation();
    try {
      setDownloading(true);
      const response = await fetch(src);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Direct download failed, falling back to window.open", err);
      // Fallback
      const link = document.createElement("a");
      link.href = src;
      link.target = "_blank";
      link.download = filename;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box
      onClick={onClose}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        bgcolor: "rgba(0, 0, 0, 0.95)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.18s ease",
        "@keyframes fadeIn": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      {/* Top bar */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          px: 2,
          py: 1.5,
          bgcolor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          zIndex: 9002,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "rgba(255,255,255,0.85)",
            fontWeight: 600,
            fontSize: 14,
            maxWidth: "calc(100% - 120px)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {filename}
        </Typography>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Download to Device">
            <IconButton
              onClick={triggerDownload}
              disabled={downloading}
              size="small"
              sx={{ color: "rgba(255,255,255,0.8)", "&:hover": { color: "#fff" } }}
            >
              {downloading ? <CircularProgress size={20} color="inherit" /> : <DownloadSimple size={22} />}
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Close (Esc)">
            <IconButton
              onClick={onClose}
              size="small"
              sx={{ color: "rgba(255,255,255,0.8)", "&:hover": { color: "#fff" } }}
              aria-label="Close preview"
            >
              <X size={22} weight="bold" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Main Content Area — Fully Immersive Screen */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 1, sm: 4 },
          boxSizing: "border-box"
        }}
      >
        {isVideo ? (
          <Box
            component="video"
            src={src}
            controls
            autoPlay
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
              animation: "scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
              "@keyframes scaleIn": {
                from: { transform: "scale(0.9)", opacity: 0 },
                to: { transform: "scale(1)", opacity: 1 },
              },
            }}
          />
        ) : (
          <Box
            component="img"
            src={src}
            alt="Preview"
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
              userSelect: "none",
              animation: "scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
              "@keyframes scaleIn": {
                from: { transform: "scale(0.9)", opacity: 0 },
                to: { transform: "scale(1)", opacity: 1 },
              },
            }}
          />
        )}
      </Box>

      {/* Hint text */}
      <Typography
        variant="caption"
        sx={{
          position: "absolute",
          bottom: 16,
          color: "rgba(255,255,255,0.4)",
          fontSize: 12,
          pointerEvents: "none",
          zIndex: 9001
        }}
      >
        Click outside or press Esc to close
      </Typography>
    </Box>
  );
}
