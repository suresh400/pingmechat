import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, Stack, Box, Button, IconButton,
  Slider, Typography, Divider, useMediaQuery, useTheme, Tooltip
} from "@mui/material";
import { Trash, Palette, X, PaperPlaneTilt, ArrowCounterClockwise, Eraser } from "phosphor-react";

export default function WhiteboardDialog({ open, onClose, socket, chatId, isGroup, currentUser, authFetch, onSendImage }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  // History stack for Undo
  const historyRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);

  // Track coordinates
  const lastX = useRef(0);
  const lastY = useRef(0);

  // Save current canvas state to history
  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current.push(imageData);
      if (historyRef.current.length > 20) historyRef.current.shift(); // Limit to 20 history states
      setCanUndo(true);
    } catch (e) {
      console.warn("Could not save canvas state", e);
    }
  }, []);

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx || historyRef.current.length === 0) return;
    
    // Pop last state
    historyRef.current.pop(); // Remove current state
    if (historyRef.current.length > 0) {
      const previousState = historyRef.current[historyRef.current.length - 1];
      ctx.putImageData(previousState, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setCanUndo(historyRef.current.length > 0);
  };

  // Setup / Resize Canvas dynamically
  const updateCanvasDimensions = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    if (width <= 0 || height <= 0) return;

    // Save existing canvas image data before resize if context exists
    let existingData = null;
    if (canvas.width > 0 && canvas.height > 0 && contextRef.current) {
      try {
        existingData = contextRef.current.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {}
    }

    const dpr = window.devicePixelRatio || 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = isEraser ? "#FFFFFF" : color;
    ctx.lineWidth = brushSize;
    contextRef.current = ctx;

    // Restore existing content if available
    if (existingData) {
      ctx.putImageData(existingData, 0, 0);
    }
  }, [brushSize, color, isEraser]);

  useEffect(() => {
    if (!open) return;

    // Initial sizing delay for modal transition
    const timer = setTimeout(() => {
      updateCanvasDimensions();
      saveState();
    }, 150);

    // Observer container resize (orientation change, window resize)
    const observer = new ResizeObserver(() => {
      updateCanvasDimensions();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [open, updateCanvasDimensions, saveState]);

  // Update stroke style when color or brush size changes
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = isEraser ? "#FFFFFF" : color;
      contextRef.current.lineWidth = brushSize;
    }
  }, [color, brushSize, isEraser]);

  // Socket listener for collaborative drawing
  useEffect(() => {
    if (!socket || !open) return;

    const handleDraw = (data) => {
      const { sender_id, drawData } = data;
      if (Number(sender_id) === Number(currentUser?.id)) return;
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
  }, [socket, open, currentUser?.id]);

  const drawOnCanvas = (x0, y0, x1, y1, strokeColor, strokeSize, emit = true) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeSize;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();

    // Reset current stroke settings
    ctx.strokeStyle = isEraser ? "#FFFFFF" : color;
    ctx.lineWidth = brushSize;

    if (emit && socket) {
      socket.emit("whiteboard_draw", {
        chat_id: chatId,
        isGroup,
        sender_id: currentUser?.id,
        drawData: { x0, y0, x1, y1, color: strokeColor, size: strokeSize }
      });
    }
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (e.type === "touchstart") {
      // Prevent screen scrolling while drawing on touch devices
      if (e.cancelable) e.preventDefault();
    }
    const { x, y } = getCoordinates(e.nativeEvent || e);
    lastX.current = x;
    lastY.current = y;
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (e.type === "touchmove") {
      if (e.cancelable) e.preventDefault();
    }
    const { x, y } = getCoordinates(e.nativeEvent || e);
    const strokeColor = isEraser ? "#FFFFFF" : color;
    drawOnCanvas(lastX.current, lastY.current, x, y, strokeColor, brushSize, true);
    lastX.current = x;
    lastY.current = y;
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    setCanUndo(false);
  };

  const handleClear = () => {
    clearCanvasLocal();
    if (socket) {
      socket.emit("whiteboard_clear", {
        chat_id: chatId,
        isGroup,
        sender_id: currentUser?.id
      });
    }
  };

  const handleSend = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `whiteboard-${Date.now()}.png`, { type: "image/png" });
      onSendImage(file);
      onClose();
    }, "image/png");
  };

  const colors = ["#000000", "#FF3B30", "#007AFF", "#34C759", "#FFCC00", "#AF52DE", "#FF9500"];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          maxHeight: isMobile ? "100vh" : "90vh",
          height: isMobile ? "100vh" : "auto",
        }
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.5, px: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Palette size={22} weight="bold" />
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: 16, sm: 20 } }}>
            Collaborative Whiteboard
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: isMobile ? 1 : 2, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ flexGrow: 1, minHeight: 0, height: "100%" }}
        >
          {/* Canvas Wrapper Box */}
          <Box
            ref={containerRef}
            sx={{
              flexGrow: 1,
              position: "relative",
              bgcolor: "#FFFFFF",
              borderRadius: 2,
              border: "1.5px solid",
              borderColor: "divider",
              overflow: "hidden",
              minHeight: { xs: 260, sm: 360, md: 440 },
              touchAction: "none", // Critical for smooth touch drawing on mobile
              cursor: isEraser ? "cell" : "crosshair"
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                touchAction: "none"
              }}
            />
          </Box>

          {/* Controls Panel */}
          <Stack
            spacing={isMobile ? 1.5 : 2.5}
            sx={{
              width: { xs: "100%", md: 220 },
              flexShrink: 0,
              justifyContent: "space-between"
            }}
          >
            <Stack spacing={isMobile ? 1 : 2}>
              {/* Tool Selection: Pen vs Eraser + Undo */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant={!isEraser ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setIsEraser(false)}
                  startIcon={<Palette size={16} />}
                  sx={{ flex: 1, borderRadius: 2, fontWeight: 700, textTransform: "none" }}
                >
                  Draw
                </Button>
                <Button
                  variant={isEraser ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setIsEraser(true)}
                  startIcon={<Eraser size={16} />}
                  sx={{ flex: 1, borderRadius: 2, fontWeight: 700, textTransform: "none" }}
                >
                  Eraser
                </Button>
                <Tooltip title="Undo">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!canUndo}
                      onClick={handleUndo}
                      sx={{ border: "1px solid", borderColor: "divider" }}
                    >
                      <ArrowCounterClockwise size={18} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>

              {/* Color Selection (Hidden when eraser selected) */}
              {!isEraser && (
                <Stack spacing={0.8}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    COLOR
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {colors.map((c) => (
                      <Box
                        key={c}
                        onClick={() => setColor(c)}
                        sx={{
                          width: { xs: 26, sm: 30 },
                          height: { xs: 26, sm: 30 },
                          borderRadius: "50%",
                          bgcolor: c,
                          cursor: "pointer",
                          border: "2.5px solid",
                          borderColor: color === c ? "text.primary" : "transparent",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                          "&:hover": { transform: "scale(1.1)" },
                          transition: "transform 0.15s ease"
                        }}
                      />
                    ))}
                  </Box>
                </Stack>
              )}

              {/* Brush / Eraser Size Slider */}
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  SIZE ({brushSize}px)
                </Typography>
                <Slider
                  value={brushSize}
                  min={1}
                  max={30}
                  onChange={(e, val) => setBrushSize(val)}
                  size="small"
                  valueLabelDisplay="auto"
                />
              </Stack>
            </Stack>

            {/* Action Buttons */}
            <Stack spacing={1} sx={{ pt: { xs: 0, md: 1 } }}>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<Trash size={18} />}
                onClick={handleClear}
                fullWidth
                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
              >
                Clear All
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PaperPlaneTilt size={18} />}
                onClick={handleSend}
                fullWidth
                sx={{ py: 1, borderRadius: 2, fontWeight: 800, textTransform: "none" }}
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
