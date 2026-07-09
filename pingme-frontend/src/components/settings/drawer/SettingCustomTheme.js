import React from "react";
import { Stack, Typography, TextField } from "@mui/material";
import useSettings from "../../../hooks/useSettings";

export default function SettingCustomTheme() {
  const {
    customPrimaryColor,
    customChatBgColor,
    customCss,
    onChangeCustomPrimaryColor,
    onChangeCustomChatBgColor,
    onChangeCustomCss,
  } = useSettings();

  return (
    <Stack spacing={2.5}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Theme Builder Style Engine</Typography>
      
      {/* Primary Color Picker */}
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">Primary Accent Color</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <input
            type="color"
            value={customPrimaryColor || "#0162C4"}
            onChange={(e) => onChangeCustomPrimaryColor(e.target.value)}
            style={{
              width: "48px",
              height: "36px",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: "6px",
              cursor: "pointer",
              padding: 0,
              background: "none"
            }}
          />
          <TextField
            size="small"
            value={customPrimaryColor || "#0162C4"}
            onChange={(e) => onChangeCustomPrimaryColor(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
        </Stack>
      </Stack>

      {/* Chat Area Background Color Picker */}
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">Chat Background Color</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <input
            type="color"
            value={customChatBgColor || "#1A1D21"}
            onChange={(e) => onChangeCustomChatBgColor(e.target.value)}
            style={{
              width: "48px",
              height: "36px",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: "6px",
              cursor: "pointer",
              padding: 0,
              background: "none"
            }}
          />
          <TextField
            size="small"
            value={customChatBgColor || "#1A1D21"}
            onChange={(e) => onChangeCustomChatBgColor(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
        </Stack>
      </Stack>

      {/* Global CSS Injection */}
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">Global Custom CSS Injection</Typography>
        <TextField
          multiline
          rows={4}
          size="small"
          placeholder="e.g. .message-box { border-radius: 20px; }"
          value={customCss || ""}
          onChange={(e) => onChangeCustomCss(e.target.value)}
          sx={{
            fontFamily: "monospace",
            "& .MuiInputBase-input": {
              fontFamily: "monospace",
              fontSize: "12px",
            }
          }}
        />
      </Stack>
    </Stack>
  );
}
