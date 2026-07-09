import React, { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Button, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { API_BASE } from "../constants";

export default function ConvertToTaskDialog({ open, onClose, messageText, currentUser, authFetch, socket, onComplete }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [selectedBoard, setSelectedBoard] = useState(`personal_${currentUser?.id}`);
  const [boards, setBoards] = useState([]);

  useEffect(() => {
    if (messageText) {
      setTitle(messageText.substring(0, 50) + (messageText.length > 50 ? "..." : ""));
      setDescription(messageText);
    }
  }, [messageText]);

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const resConvs = await authFetch(`${API_BASE}/messages/conversations`);
        const convs = await resConvs.json();
        
        const resGroups = await authFetch(`${API_BASE}/groups`);
        const groups = await resGroups.json();

        const list = [
          { id: `personal_${currentUser?.id}`, name: "Personal Board" }
        ];

        if (Array.isArray(convs)) {
          convs.forEach(c => list.push({ id: String(c.id), name: `Chat with ${c.username}` }));
        }
        if (Array.isArray(groups)) {
          groups.forEach(g => list.push({ id: String(g.id), name: `Group: ${g.name}` }));
        }

        setBoards(list);
      } catch (err) {
        console.error("Error fetching boards:", err);
      }
    };

    if (open) {
      fetchBoards();
    }
  }, [open, authFetch, currentUser]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    try {
      const res = await authFetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: selectedBoard,
          title: title.trim(),
          description: description.trim(),
          status
        })
      });

      if (res.ok) {
        if (socket) {
          socket.emit("task_update", { chatId: selectedBoard });
        }
        onComplete();
        onClose();
      }
    } catch (err) {
      console.error("Error converting message to task:", err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Convert Message to Kanban Task</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Select Kanban Board</InputLabel>
            <Select
              value={selectedBoard}
              label="Select Kanban Board"
              onChange={(e) => setSelectedBoard(e.target.value)}
            >
              {boards.map(b => (
                <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Task Title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={status}
              label="Status"
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="todo">To Do</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="done">Done</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">Add to Board</Button>
      </DialogActions>
    </Dialog>
  );
}
