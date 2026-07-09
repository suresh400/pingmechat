import React, { useState, useEffect } from "react";
import { Stack, Typography } from "@mui/material";
import { Hourglass } from "phosphor-react";

export default function SelfDestructCountdown({ messageId, seconds, isGroup, chatId, authFetch, onDeleteLocal }) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      authFetch(`/messages/single/${messageId}?isGroup=${isGroup}&chatId=${chatId}`, {
        method: "DELETE",
      }).catch((err) => console.error("Self destruct API failed:", err));
      onDeleteLocal(messageId);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
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
