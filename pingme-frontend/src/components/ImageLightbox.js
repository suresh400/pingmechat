import React, { useEffect, useCallback } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { X, DownloadSimple, ArrowsOut } from "phosphor-react";

/**
 * ImageLightbox
 * Props:
 *   src   – image URL
 *   onClose – function to close
 */
export default function ImageLightbox({ src, onClose }) {
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

  const filename = src.split("/").pop().split("?")[0] || "image";

  return (
    <Box
      onClick={onClose}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        bgcolor: "rgba(0, 0, 0, 0.92)",
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
          bgcolor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          zIndex: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "rgba(255,255,255,0.7)",
            fontWeight: 600,
            fontSize: 13,
            maxWidth: "calc(100% - 100px)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {filename}
        </Typography>

        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Open original">
            <IconButton
              component="a"
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "#fff" } }}
            >
              <ArrowsOut size={20} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download">
            <IconButton
              component="a"
              href={src}
              download={filename}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "#fff" } }}
            >
              <DownloadSimple size={20} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close (Esc)">
            <IconButton
              onClick={onClose}
              size="small"
              sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "#fff" } }}
              aria-label="Close image preview"
            >
              <X size={22} weight="bold" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Image — clicking backdrop closes, clicking image stops propagation */}
      <Box
        component="img"
        src={src}
        alt="Preview"
        onClick={(e) => e.stopPropagation()}
        sx={{
          maxWidth: "92vw",
          maxHeight: "85vh",
          objectFit: "contain",
          borderRadius: 2,
          boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
          userSelect: "none",
          animation: "scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          "@keyframes scaleIn": {
            from: { transform: "scale(0.88)", opacity: 0 },
            to: { transform: "scale(1)", opacity: 1 },
          },
        }}
      />

      {/* Hint text */}
      <Typography
        variant="caption"
        sx={{
          position: "absolute",
          bottom: 16,
          color: "rgba(255,255,255,0.3)",
          fontSize: 12,
          pointerEvents: "none",
        }}
      >
        Click outside or press Esc to close
      </Typography>
    </Box>
  );
}
