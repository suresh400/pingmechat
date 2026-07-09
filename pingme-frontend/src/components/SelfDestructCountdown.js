import React, { useState, useEffect } from "react";
import { Stack, Typography } from "@mui/material";
import { Hourglass } from "phosphor-react";

export default function SelfDestructCountdown({ messageId, seconds, createdAt, isGroup, chatId, authFetch, onDeleteLocal }) {
  const getRemainingTime = () => {
    if (!createdAt) return seconds;
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return Math.max(0, seconds - elapsed);
  };

  const [timeLeft, setTimeLeft] = useState(getRemainingTime);

  useEffect(() => {
    setTimeLeft(getRemainingTime());
  }, [createdAt, seconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      authFetch(`/messages/single/${messageId}?isGroup=${isGroup}&chatId=${chatId}`, {
        method: "DELETE",
      }).catch((err) => console.error("Self destruct API failed:", err));
      onDeleteLocal(messageId);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, messageId, isGroup, chatId, authFetch, onDeleteLocal]);

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "error.main" }}>
      <Hourglass size={12} weight="fill" />
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10 }}>
        {timeLeft}s
      </Typography>
    </Stack>
  );
}
