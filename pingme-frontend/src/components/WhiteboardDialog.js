import React, { useRef, useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, Stack, Box, Button, IconButton, Slider, Typography, Divider } from "@mui/material";
import { Trash, Palette, X, PaperPlaneTilt } from "phosphor-react";

export default function WhiteboardDialog({ open, onClose, socket, chatId, isGroup, currentUser, authFetch, onSendImage }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  
  // Keep track of last coordinates
  const lastX = useRef(0);
  const lastY = useRef(0);

  useEffect(() => {
    if (!open) return;
    
    // Set up canvas when modal opens
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Get display dimensions
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      const context = canvas.getContext("2d");
      context.scale(2, 2);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = color;
      context.lineWidth = brushSize;
      contextRef.current = context;
    }, 100);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Handle color or size change
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
      contextRef.current.lineWidth = brushSize;
    }
  }, [color, brushSize]);

  // Listen for socket events
  useEffect(() => {
    if (!socket || !open) return;

    const handleDraw = (data) => {
      const { sender_id, drawData } = data;
      if (Number(sender_id) === Number(currentUser.id)) return;
      drawOnCanvas(drawData.x0, drawData.y0, drawData.x1, drawData.y1, drawData.color, drawData.size, false);
    };

    const handleClear = () => {
      clearCanvasLocal();
    };

    socket.on("whiteboard_draw", handleDraw);
    socket.on("whiteboard_clear", handleClear);

    return () => {
      socket.off("whiteboard_draw", handleDraw);
      socket.off("whiteboard_clear", handleClear);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, open, currentUser.id]);

  const drawOnCanvas = (x0, y0, x1, y1, strokeColor, strokeSize, emit = true) => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    context.beginPath();
    context.strokeStyle = strokeColor;
    context.lineWidth = strokeSize;
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
    context.closePath();

    // Reset current selected brush settings
    context.strokeStyle = color;
    context.lineWidth = brushSize;

    if (emit && socket) {
      socket.emit("whiteboard_draw", {
        chat_id: chatId,
        isGroup,
        sender_id: currentUser.id,
        drawData: { x0, y0, x1, y1, color: strokeColor, size: strokeSize }
      });
    }
  };

  const startDrawing = ({ nativeEvent }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (nativeEvent.touches) {
      clientX = nativeEvent.touches[0].clientX;
      clientY = nativeEvent.touches[0].clientY;
    } else {
      clientX = nativeEvent.clientX;
      clientY = nativeEvent.clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    lastX.current = x;
    lastY.current = y;
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (nativeEvent.touches) {
      clientX = nativeEvent.touches[0].clientX;
      clientY = nativeEvent.touches[0].clientY;
    } else {
      clientX = nativeEvent.clientX;
      clientY = nativeEvent.clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    drawOnCanvas(lastX.current, lastY.current, x, y, color, brushSize, true);
    lastX.current = x;
    lastY.current = y;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClear = () => {
    clearCanvasLocal();
    if (socket) {
      socket.emit("whiteboard_clear", {
        chat_id: chatId,
        isGroup,
        sender_id: currentUser.id
      });
    }
  };

  const handleSend = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to image blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `whiteboard-${Date.now()}.png`, { type: "image/png" });
      onSendImage(file);
      onClose();
    }, "image/png");
  };

  const colors = ["#000000", "#FF3B30", "#007AFF", "#34C759", "#FFCC00", "#AF52DE", "#FF9500"];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Palette size={24} weight="bold" />
          <Typography variant="h6">Collaborative Whiteboard</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <X size={20} />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
          {/* Drawing Canvas */}
          <Box sx={{ flexGrow: 1, position: "relative", bgcolor: "#FAFAFA", borderRadius: 2, border: "1px solid", borderColor: "divider", minHeight: 400, overflow: "hidden" }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ display: "block", cursor: "crosshair", background: "white", width: "100%", height: "100%" }}
            />
          </Box>

          {/* Controls Panel */}
          <Stack spacing={3} sx={{ width: { xs: "100%", md: 200 }, flexShrink: 0 }}>
            {/* Color selection */}
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">Stroke Color</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {colors.map((c) => (
                  <Box
                    key={c}
                    onClick={() => setColor(c)}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      bgcolor: c,
                      cursor: "pointer",
                      border: "2.5px solid",
                      borderColor: color === c ? "text.primary" : "transparent",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      "&:hover": { transform: "scale(1.1)" },
                      transition: "transform 0.15s ease"
                    }}
                  />
                ))}
              </Box>
            </Stack>

            {/* Brush size */}
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">Brush Size ({brushSize}px)</Typography>
              <Slider
                value={brushSize}
                min={1}
                max={20}
                onChange={(e, val) => setBrushSize(val)}
                valueLabelDisplay="auto"
              />
            </Stack>

            <Divider sx={{ borderStyle: "dashed" }} />

            {/* Actions */}
            <Stack spacing={1.5}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Trash size={18} />}
                onClick={handleClear}
                fullWidth
              >
                Clear Canvas
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PaperPlaneTilt size={18} />}
                onClick={handleSend}
                fullWidth
                sx={{ py: 1.2, fontWeight: 700 }}
              >
                Send to Chat
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
