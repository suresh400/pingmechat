import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Stack, Typography, Grid, Paper, Button, IconButton, TextField,
  Select, MenuItem, InputLabel, FormControl, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, useTheme, Card, CardContent, Divider
} from "@mui/material";
import { Plus, Trash, ListChecks, CheckCircle, PlayCircle, Circle } from "phosphor-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { API_BASE } from "../../constants";

export default function TasksPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { currentUser, authFetch } = useAuth();
  const socket = useSocket();

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(`personal_${currentUser?.id}`);
  const [tasks, setTasks] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  
  // Create task state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");

  // Fetch chats/groups list to filter tasks
  useEffect(() => {
    const fetchChatsAndGroups = async () => {
      try {
        // Fetch active conversations
        const resConvs = await authFetch(`${API_BASE}/messages/conversations`);
        const convs = await resConvs.json();
        
        // Fetch groups
        const resGroups = await authFetch(`${API_BASE}/groups`);
        const groups = await resGroups.json();

        const list = [
          { id: `personal_${currentUser?.id}`, name: "Personal Board (Private)" }
        ];

        if (Array.isArray(convs)) {
          convs.forEach(c => list.push({ id: String(c.id), name: `Chat with ${c.username}` }));
        }
        if (Array.isArray(groups)) {
          groups.forEach(g => list.push({ id: String(g.id), name: `Group: ${g.name}` }));
        }

        setChats(list);
      } catch (err) {
        console.error("Error loading chat list for tasks:", err);
      }
    };

    fetchChatsAndGroups();
  }, [authFetch, currentUser]);

  // Fetch tasks for the selected board
  const fetchTasks = useCallback(async () => {
    if (!selectedChat) return;
    try {
      const res = await authFetch(`${API_BASE}/tasks/${selectedChat}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  }, [authFetch, selectedChat]);

  useEffect(() => {
    fetchTasks();
  }, [selectedChat, fetchTasks]);

  // Socket syncing for real-time task updates
  useEffect(() => {
    if (!socket) return;
    const handleTaskSync = (data) => {
      // Refresh tasks if it matches our active board
      if (String(data.chatId) === String(selectedChat)) {
        fetchTasks();
      }
    };

    socket.on("task_update", handleTaskSync);
    return () => {
      socket.off("task_update", handleTaskSync);
    };
  }, [socket, selectedChat, fetchTasks]);

  const handleCreateTask = async () => {
    if (!title.trim()) return;
    try {
      const res = await authFetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: selectedChat,
          title: title.trim(),
          description: description.trim(),
          status
        })
      });

      if (res.ok) {
        setOpenCreate(false);
        setTitle("");
        setDescription("");
        setStatus("todo");
        fetchTasks();

        // Broadcast change via socket
        if (socket) {
          socket.emit("task_update", { chatId: selectedChat });
        }
      }
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const res = await authFetch(`${API_BASE}/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        fetchTasks();
        if (socket) {
          socket.emit("task_update", { chatId: selectedChat });
        }
      }
    } catch (err) {
      console.error("Error updating task status:", err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const res = await authFetch(`${API_BASE}/tasks/${taskId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        fetchTasks();
        if (socket) {
          socket.emit("task_update", { chatId: selectedChat });
        }
      }
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetStatus) => {
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      handleUpdateStatus(taskId, targetStatus);
    }
  };

  const renderColumn = (colStatus, colTitle, icon) => {
    const filtered = tasks.filter(t => t.status === colStatus);
    return (
      <Grid item xs={12} md={4} key={colStatus}>
        <Paper
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, colStatus)}
          sx={{
            p: 2,
            minHeight: 500,
            bgcolor: isDark ? "background.neutral" : "#F4F6F8",
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            gap: 2
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              {icon}
              <Typography variant="subtitle1" fontWeight={700}>{colTitle}</Typography>
            </Stack>
            <Chip label={filtered.length} size="small" sx={{ fontWeight: 700 }} />
          </Stack>

          <Divider />

          <Stack spacing={2} sx={{ flexGrow: 1, overflowY: "auto" }}>
            {filtered.map(task => (
              <Card
                key={task._id || task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task._id || task.id)}
                sx={{
                  bgcolor: "background.paper",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  cursor: "grab",
                  border: "1px solid",
                  borderColor: "divider",
                  "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }
                }}
              >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Typography variant="subtitle2" fontWeight={600} mb={0.5}>{task.title}</Typography>
                  {task.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, wordBreak: "break-word" }}>
                      {task.description}
                    </Typography>
                  )}

                  <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
                    <Stack direction="row" spacing={0.5}>
                      {colStatus !== "todo" && (
                        <IconButton size="small" onClick={() => handleUpdateStatus(task._id || task.id, "todo")} title="Move to Todo">
                          <Circle size={16} />
                        </IconButton>
                      )}
                      {colStatus !== "in_progress" && (
                        <IconButton size="small" onClick={() => handleUpdateStatus(task._id || task.id, "in_progress")} title="Move to In Progress">
                          <PlayCircle size={16} />
                        </IconButton>
                      )}
                      {colStatus !== "done" && (
                        <IconButton size="small" onClick={() => handleUpdateStatus(task._id || task.id, "done")} title="Move to Done">
                          <CheckCircle size={16} color="#34C759" />
                        </IconButton>
                      )}
                    </Stack>

                    <IconButton size="small" color="error" onClick={() => handleDeleteTask(task._id || task.id)}>
                      <Trash size={16} />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}

            {filtered.length === 0 && (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, py: 4, opacity: 0.5 }}>
                <Typography variant="body2">Drag files or tasks here</Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      </Grid>
    );
  };

  return (
    <Box sx={{ flexGrow: 1, height: "100%", overflowY: "auto", p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ListChecks size={32} weight="bold" />
          <Typography variant="h5" fontWeight={800}>Productivity Kanban Board</Typography>
        </Stack>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<Plus size={18} />}
          onClick={() => setOpenCreate(true)}
          sx={{ fontWeight: 700 }}
        >
          New Task
        </Button>
      </Stack>

      {/* Board Selector */}
      <Box sx={{ maxWidth: 400 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Select Kanban Board</InputLabel>
          <Select
            value={selectedChat}
            label="Select Kanban Board"
            onChange={(e) => setSelectedChat(e.target.value)}
          >
            {chats.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Kanban lanes */}
      <Grid container spacing={3} sx={{ flexGrow: 1 }}>
        {renderColumn("todo", "To Do", <Circle size={20} />)}
        {renderColumn("in_progress", "In Progress", <PlayCircle size={20} color="#FF9500" />)}
        {renderColumn("done", "Done", <CheckCircle size={20} color="#34C759" />)}
      </Grid>

      {/* Create Dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create New Task</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
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
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button onClick={handleCreateTask} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
