const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./config/db");
const { verifyToken, JWT_SECRET } = require("./middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { RtcTokenBuilder, RtcRole } = require("agora-token");
const { sendOTPEmail } = require("./config/mailer");
const {
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateVerifyOtp,
    validateResendOtp,
    validateResetPassword,
    validateChangePassword,
    validateProfile,
    validateBlockUser,
    validateUnblockUser,
    validateSendMessage
} = require("./middleware/validate");

require("dotenv").config();

const AGORA_APP_ID = process.env.AGORA_APP_ID || "";
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || "";

// ── CORS origin list ─────────────────────────────────────────────────────────
// FRONTEND_URL is set to your Vercel URL in .env (see .env for instructions)
const rawFrontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const frontendUrls = rawFrontendUrl.split(",").map(url => url.trim().replace(/\/$/, ""));
const ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...frontendUrls
].filter(Boolean);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ["GET", "POST"],
        credentials: true,
    },
});

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url} - body:`, req.body);
    next();
});
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// Reset all users to offline on server start
db.query("UPDATE users SET is_online = 0").catch(err => console.error("[Init] Status reset error:", err.message));

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────
const onlineUsers = new Map(); // userId -> Set(socketIds)

io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;
    if (userId) {
        const uid = String(userId);
        if (!onlineUsers.has(uid)) {
            onlineUsers.set(uid, new Set());
        }
        onlineUsers.get(uid).add(socket.id);
        socket.join(`user_${uid}`);

        const socketCount = onlineUsers.get(uid).size;
        console.log(`[Presence] User ${uid} CONNECTED (socket: ${socket.id}, total: ${socketCount})`);

        // Update online status ONLY on first connection
        if (socketCount === 1) {
            db.query("UPDATE users SET is_online = 1 WHERE id = ?", [uid])
                .then(([result]) => {
                    console.log(`[Presence] User ${uid} is now ONLINE in DB (affectedRows: ${result.affectedRows})`);
                    io.emit("user_status_update", { userId: uid, is_online: 1 });
                })
                .catch(err => console.error(`[Presence] User ${uid} ONLINE update error:`, err.message));
        }
    }

    // DM message
    socket.on("send_message", async (data) => {
        const { sender_id, receiver_id, message, sender_name, sender_avatar } = data;
        const sid = Number(sender_id);
        const rid = Number(receiver_id);
        console.log(`[socket] send_message attempt: ${sid} -> ${rid}`);
        try {
            // Check if EITHER has blocked the other
            const [blockCheck] = await db.query(
                "SELECT * FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
                [rid, sid, sid, rid]
            );

            if (blockCheck.length > 0) {
                const isBlockedByRecipient = blockCheck.some(r => r.blocker_id === rid);
                console.log(`[socket] BLOCK ACTIVE: ${sid} <-> ${rid}. Blocked by: ${isBlockedByRecipient ? 'Recipient' : 'Sender'}`);
                return socket.emit("message_blocked", {
                    receiver_id: rid,
                    message: isBlockedByRecipient ? "You are blocked by this user" : "You have blocked this user",
                    _originalData: data
                });
            }

            const [result] = await db.query(
                "INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
                [sid, rid, message]
            );
            const payload = {
                id: result.insertId,
                sender_id: Number(sender_id),
                receiver_id: Number(receiver_id),
                message,
                sender_name,
                sender_avatar,
                created_at: new Date().toISOString(),
            };
            // Send to receiver's room
            io.to(`user_${receiver_id}`).emit("receive_message", payload);
            // Send back to sender (confirmation)
            socket.emit("receive_message", payload);
        } catch (err) {
            console.error("[send_message] Error:", err.message);
            socket.emit("error", { message: "Failed to send message" });
        }
    });

    // Group message
    socket.on("send_group_message", async (data) => {
        const { group_id, sender_id, message, sender_name, sender_avatar } = data;
        try {
            const [result] = await db.query(
                "INSERT INTO group_messages (group_id, sender_id, message) VALUES (?, ?, ?)",
                [group_id, sender_id, message]
            );
            const payload = {
                id: result.insertId,
                group_id,
                sender_id,
                message,
                sender_name,
                sender_avatar,
                created_at: new Date().toISOString(),
            };
            io.to(`group_${group_id}`).emit("receive_group_message", payload);
        } catch (err) {
            socket.emit("error", { message: "Failed to send group message" });
        }
    });

    socket.on("mark_read", async (data) => {
        const { messageId, sender_id } = data;
        try {
            await db.query("UPDATE messages SET is_read = 1 WHERE id = ?", [messageId]);
            io.to(`user_${sender_id}`).emit("message_read", { messageId });
        } catch (err) {
            console.error("[mark_read] Error:", err.message);
        }
    });

    // Join group room
    socket.on("join_group", (groupId) => {
        socket.join(`group_${groupId}`);
    });

    socket.on("disconnecting", () => {
        for (const room of socket.rooms) {
            if (room.startsWith("call_")) {
                const callLogId = room.replace("call_", "");
                process.nextTick(async () => {
                    const r = io.sockets.adapter.rooms.get(room);
                    const activeCount = r ? r.size : 0;
                    console.log(`[Presence] Checking room ${room} after disconnect. Remaining size: ${activeCount}`);
                    if (activeCount === 0) {
                        console.log(`[Presence] Call ${callLogId} empty after user disconnect. Ending call.`);
                        try {
                            const [[callLog]] = await db.query("SELECT group_id FROM call_logs WHERE id = ?", [callLogId]);
                            await db.query(
                                "UPDATE call_logs SET status = 'accepted', ended_at = NOW() WHERE id = ? AND status = 'calling'",
                                [callLogId]
                            );
                            if (callLog && callLog.group_id) {
                                const [members] = await db.query("SELECT user_id FROM group_members WHERE group_id = ?", [callLog.group_id]);
                                members.forEach((m) => {
                                    io.to(`user_${m.user_id}`).emit("group_call_cancelled", { group_id: callLog.group_id });
                                });
                            }
                        } catch (err) {
                            console.error("[disconnecting call cleanup] Error:", err.message);
                        }
                    }
                });
            }
        }
    });

    socket.on("disconnect", () => {
        if (userId) {
            const uid = String(userId);
            if (onlineUsers.has(uid)) {
                onlineUsers.get(uid).delete(socket.id);
                const socketCount = onlineUsers.get(uid).size;
                console.log(`[Presence] User ${uid} DISCONNECTED (socket: ${socket.id}, remaining: ${socketCount})`);

                // Update offline status ONLY on last connection
                if (socketCount === 0) {
                    onlineUsers.delete(uid);
                    db.query("UPDATE users SET is_online = 0, last_seen = NOW() WHERE id = ?", [uid])
                        .then(([result]) => {
                            console.log(`[Presence] DB UPDATE SUCCESS for User ${uid}: is_online=0 (affectedRows: ${result.affectedRows})`);
                            io.emit("user_status_update", { userId: uid, is_online: 0, last_seen: new Date() });
                        })
                        .catch(err => console.error(`[Presence] DB UPDATE ERROR for User ${uid}:`, err.message));
                }
            }
        }
    });

    // ─── CALL SIGNALING ───────────────────────────────────────────────────
    socket.on("start_call", async (data) => {
        const { sender_id, receiver_id, type } = data;
        const sid = Number(sender_id);
        const rid = Number(receiver_id);
        try {
            // Check if EITHER has blocked the other
            const [blockCheck] = await db.query(
                "SELECT * FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
                [rid, sid, sid, rid]
            );
            if (blockCheck.length > 0) {
                const isBlockedByRecipient = blockCheck.some(r => r.blocker_id === rid);
                console.log(`[socket] CALL BLOCKED: ${sid} <-> ${rid}`);
                return socket.emit("error", { message: isBlockedByRecipient ? "You are blocked by this user" : "You have blocked this user" });
            }

            // Create a server-side call log so both parties can reference it
            const [result] = await db.query(
                "INSERT INTO call_logs (caller_id, receiver_id, call_type, status) VALUES (?, ?, ?, 'calling')",
                [sid, rid, type]
            );
            const callLogId = result.insertId;

            const receiverSocket = onlineUsers.get(String(receiver_id));
            if (receiverSocket) {
                io.to(`user_${receiver_id}`).emit("incoming_call", {
                    from: sender_id,
                    type,
                    callerName: data.callerName,
                    callerAvatar: data.callerAvatar,
                    callLogId,
                });
            }
            // Confirm to caller with the generated callLogId
            socket.emit("call_started", { callLogId });
        } catch (err) {
            console.error("[start_call] Error:", err.message);
        }
    });

    socket.on("start_group_call", async (data) => {
        const { group_id, type, callerName, callerAvatar, sender_id } = data;
        const gid = Number(group_id);
        console.log(`[GroupCall] start_group_call received: group_id=${group_id}, type=${type}, sender_id=${sender_id}`);
        try {
            // Get group details
            const [[group]] = await db.query("SELECT * FROM groups_table WHERE id = ?", [gid]);
            if (!group) {
                console.log(`[GroupCall] Group not found for id ${gid}`);
                return;
            }

            // Create a call log in database
            const [result] = await db.query(
                "INSERT INTO call_logs (caller_id, group_id, call_type, status) VALUES (?, ?, ?, 'calling')",
                [sender_id, gid, type]
            );
            const callLogId = result.insertId;

            // Add initiator to call_participants
            await db.query(
                "INSERT INTO call_participants (call_log_id, user_id) VALUES (?, ?)",
                [callLogId, sender_id]
            );

            // Confirm callLogId back to the caller
            socket.emit("call_started", { callLogId });

            // Join the initiator to the call socket room
            socket.join(`call_${callLogId}`);
            console.log(`[GroupCall] Initiator user_${sender_id} joined socket room call_${callLogId}`);

            // Get group members
            const [members] = await db.query("SELECT user_id FROM group_members WHERE group_id = ?", [gid]);
            console.log(`[GroupCall] Found ${members.length} members for group ${group.name} (id: ${gid})`);
            
            // Emit incoming group call to all online members except the caller
            members.forEach((m) => {
                const memberId = m.user_id;
                console.log(`[GroupCall] Checking member ${memberId}. Comparing with sender ${sender_id}`);
                if (memberId !== Number(sender_id)) {
                    console.log(`[GroupCall] Emitting incoming_group_call to user_${memberId}`);
                    io.to(`user_${memberId}`).emit("incoming_group_call", {
                        groupId: gid,
                        groupName: group.name,
                        groupAvatar: group.avatar,
                        from: sender_id,
                        type,
                        callerName,
                        callerAvatar,
                        callLogId: callLogId,
                    });
                }
            });
        } catch (err) {
            console.error("[start_group_call] Error:", err.message);
        }
    });

    socket.on("join_group_call", (data) => {
        const { callLogId, group_id } = data;
        if (!callLogId) return;
        socket.join(`call_${callLogId}`);
        const roomSize = io.sockets.adapter.rooms.get(`call_${callLogId}`)?.size || 0;
        console.log(`[GroupCall] User joined socket room call_${callLogId}. Active sockets count: ${roomSize}`);
    });

    socket.on("leave_group_call", async (data) => {
        const { callLogId, group_id } = data;
        if (!callLogId) return;
        socket.leave(`call_${callLogId}`);
        console.log(`[GroupCall] User left socket room call_${callLogId}`);
        
        // Check remaining sockets in room
        const room = io.sockets.adapter.rooms.get(`call_${callLogId}`);
        const activeCount = room ? room.size : 0;
        console.log(`[GroupCall] Remaining active sockets in call_${callLogId}: ${activeCount}`);
        
        if (activeCount === 0) {
            console.log(`[GroupCall] Call ${callLogId} has ended (0 active members). Cancelling for all others.`);
            try {
                // End the call log status
                await db.query(
                    "UPDATE call_logs SET status = 'accepted', ended_at = NOW() WHERE id = ? AND status = 'calling'",
                    [callLogId]
                );

                const gid = Number(group_id);
                const [members] = await db.query("SELECT user_id FROM group_members WHERE group_id = ?", [gid]);
                members.forEach((m) => {
                    io.to(`user_${m.user_id}`).emit("group_call_cancelled", { group_id: gid });
                });
            } catch (err) {
                console.error("[leave_group_call] Error:", err.message);
            }
        }
    });

    socket.on("cancel_group_call", async (data) => {
        const { group_id, sender_id } = data;
        const gid = Number(group_id);
        console.log(`[GroupCall] cancel_group_call received: group_id=${group_id}, sender_id=${sender_id}`);
        try {
            // Cancel the call log
            await db.query(
                "UPDATE call_logs SET status = 'missed', ended_at = NOW() WHERE group_id = ? AND caller_id = ? AND status = 'calling'",
                [gid, sender_id]
            );

            const [members] = await db.query("SELECT user_id FROM group_members WHERE group_id = ?", [gid]);
            members.forEach((m) => {
                if (m.user_id !== Number(sender_id)) {
                    console.log(`[GroupCall] Emitting group_call_cancelled to user_${m.user_id}`);
                    io.to(`user_${m.user_id}`).emit("group_call_cancelled", { group_id: gid });
                }
            });
        } catch (err) {
            console.error("[cancel_group_call] Error:", err.message);
        }
    });

    socket.on("cancel_call", async (data) => {
        const { to, callLogId } = data;
        const targetSocket = onlineUsers.get(String(to));
        if (targetSocket) io.to(`user_${to}`).emit("call_cancelled");

        if (callLogId) {
            try {
                await db.query("UPDATE call_logs SET status='missed', ended_at=NOW() WHERE id=?", [callLogId]);
                const [logs] = await db.query(
                    `SELECT cl.*, u1.username AS caller_name, u1.avatar AS caller_avatar,
                             u2.username AS receiver_name, u2.avatar AS receiver_avatar
                     FROM call_logs cl
                     JOIN users u1 ON cl.caller_id = u1.id
                     JOIN users u2 ON cl.receiver_id = u2.id
                     WHERE cl.id = ?`, [callLogId]
                );
                if (logs.length > 0) {
                    io.to(`user_${logs[0].caller_id}`).emit("call_log_updated", logs[0]);
                    io.to(`user_${logs[0].receiver_id}`).emit("call_log_updated", logs[0]);
                }
            } catch (err) { console.error("cancel_call log err:", err.message); }
        }
    });

    socket.on("decline_call", async (data) => {
        const { to, callLogId } = data;
        const targetSocket = onlineUsers.get(String(to));
        if (targetSocket) io.to(`user_${to}`).emit("call_declined");

        if (callLogId) {
            try {
                await db.query(
                    "UPDATE call_logs SET status='declined', ended_at=NOW() WHERE id=?",
                    [callLogId]
                );
                const [logs] = await db.query(
                    `SELECT cl.*, u1.username AS caller_name, u1.avatar AS caller_avatar,
                             u2.username AS receiver_name, u2.avatar AS receiver_avatar
                     FROM call_logs cl
                     JOIN users u1 ON cl.caller_id = u1.id
                     JOIN users u2 ON cl.receiver_id = u2.id
                     WHERE cl.id = ?`, [callLogId]
                );
                if (logs.length > 0) {
                    io.to(`user_${logs[0].caller_id}`).emit("call_log_updated", logs[0]);
                    io.to(`user_${logs[0].receiver_id}`).emit("call_log_updated", logs[0]);
                }
            } catch (err) { console.error("decline_call log err:", err.message); }
        }
    });

    socket.on("accept_call", async (data) => {
        const { to, callLogId } = data;
        const targetSocket = onlineUsers.get(String(to));
        if (targetSocket) io.to(`user_${to}`).emit("call_accepted");

        if (callLogId) {
            try {
                await db.query(
                    "UPDATE call_logs SET status='accepted' WHERE id=?",
                    [callLogId]
                );
            } catch (err) { console.error("accept_call log err:", err.message); }
        }
    });

    socket.on("end_call", async (data) => {
        const { callLogId, duration_seconds } = data;
        if (!callLogId) return;
        try {
            await db.query(
                "UPDATE call_logs SET status='accepted', duration_seconds=?, ended_at=NOW() WHERE id=?",
                [duration_seconds || 0, callLogId]
            );
            const [logs] = await db.query(
                `SELECT cl.*, u1.username AS caller_name, u1.avatar AS caller_avatar,
                         u2.username AS receiver_name, u2.avatar AS receiver_avatar
                 FROM call_logs cl
                 JOIN users u1 ON cl.caller_id = u1.id
                 JOIN users u2 ON cl.receiver_id = u2.id
                 WHERE cl.id = ?`, [callLogId]
            );
            if (logs.length > 0) {
                io.to(`user_${logs[0].caller_id}`).emit("call_log_updated", logs[0]);
                io.to(`user_${logs[0].receiver_id}`).emit("call_log_updated", logs[0]);
            }
        } catch (err) { console.error("end_call log err:", err.message); }
    });
});

// ─── AUTH ────────────────────────────────────────────────────────────────────

// Check username availability
app.get("/api/auth/check-username", async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json({ available: false });
    try {
        const [rows] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
        res.json({ available: rows.length === 0 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Register
app.post("/api/auth/register", validateRegister, async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
        return res.status(400).json({ message: "All fields are required." });

    try {
        const [existingEmail] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existingEmail.length > 0)
            return res.status(409).json({ message: "Email already registered." });

        const [existingUsername] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
        if (existingUsername.length > 0)
            return res.status(409).json({ message: "Username already taken. Please choose another." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
        const [result] = await db.query(
            "INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)",
            [username, email, hashedPassword, avatarUrl]
        );
        const token = jwt.sign(
            { id: result.insertId, username, email, avatar: avatarUrl },
            JWT_SECRET, { expiresIn: "7d" }
        );
        res.status(201).json({ token, user: { id: result.insertId, username, email, avatar: avatarUrl } });
    } catch (err) {
        res.status(500).json({ message: "Server error.", error: err.message });
    }
});

// Login
app.post("/api/auth/login", validateLogin, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: "Email and password required." });

    try {
        const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        if (rows.length === 0)
            return res.status(401).json({ message: "Invalid email or password." });

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(401).json({ message: "Invalid email or password." });

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
            JWT_SECRET, { expiresIn: "7d" }
        );
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar } });
    } catch (err) {
        res.status(500).json({ message: "Server error.", error: err.message });
    }
});
// ─── PASSWORD RESET (OTP FLOW) ────────────────────────────────────────────────

// Rate-limit map: email -> { count, resetAt }
const otpRequestMap = new Map();
const MAX_OTP_REQUESTS = 5; // max 5 requests per hour per email
const OTP_HOUR_MS = 60 * 60 * 1000;

function checkRateLimit(email) {
    const now = Date.now();
    const entry = otpRequestMap.get(email);
    if (!entry || now > entry.resetAt) {
        otpRequestMap.set(email, { count: 1, resetAt: now + OTP_HOUR_MS });
        return true;
    }
    if (entry.count >= MAX_OTP_REQUESTS) return false;
    entry.count++;
    return true;
}

// Step 1 — Request OTP
app.post("/api/auth/forgot-password", validateForgotPassword, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const normalizedEmail = email.trim().toLowerCase();

    // Rate limit check
    if (!checkRateLimit(normalizedEmail)) {
        return res.status(429).json({ message: "Too many OTP requests. Please try again in 1 hour." });
    }

    try {
        const [users] = await db.query("SELECT id, username FROM users WHERE email = ?", [normalizedEmail]);
        // Always respond success to prevent email enumeration attacks
        if (users.length === 0) {
            return res.json({ message: "If this email is registered, an OTP has been sent." });
        }
        const user = users[0];

        // Invalidate any previous unused OTPs for this user
        await db.query("UPDATE password_reset_otps SET used = TRUE WHERE user_id = ? AND used = FALSE", [user.id]);

        // Generate 6-digit OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await db.query(
            "INSERT INTO password_reset_otps (user_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?)",
            [user.id, normalizedEmail, otpHash, expiresAt]
        );

        // Send email — if SMTP not configured, log OTP to console (dev mode)
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            try {
                await sendOTPEmail(normalizedEmail, user.username, otp);
                console.log(`[forgot-password] ✅ OTP email sent to ${normalizedEmail}`);
            } catch (emailErr) {
                console.error(`[forgot-password] ❌ Failed to send email to ${normalizedEmail}:`, emailErr.message);
                return res.status(500).json({ message: "Failed to send OTP email. Please try again later." });
            }
        } else {
            console.log(`[DEV MODE] OTP for ${normalizedEmail}: ${otp}`);
        }

        res.json({ message: "If this email is registered, an OTP has been sent." });
    } catch (err) {
        console.error("[forgot-password] Error:", err.message);
        res.status(500).json({ message: "Failed to process request. Please try again." });
    }
});

// Step 2 — Verify OTP
app.post("/api/auth/verify-otp", validateVerifyOtp, async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

    const normalizedEmail = email.trim().toLowerCase();
    const MAX_ATTEMPTS = 5;

    try {
        const [rows] = await db.query(
            `SELECT * FROM password_reset_otps 
             WHERE email = ? AND used = FALSE 
             ORDER BY created_at DESC LIMIT 1`,
            [normalizedEmail]
        );

        if (rows.length === 0) return res.status(400).json({ message: "No active OTP found. Please request a new one." });

        const record = rows[0];

        // Check expiry
        if (new Date() > new Date(record.expires_at)) {
            await db.query("UPDATE password_reset_otps SET used = TRUE WHERE id = ?", [record.id]);
            return res.status(400).json({ message: "OTP has expired. Please request a new one.", code: "EXPIRED" });
        }

        // Check attempts
        if (record.attempts >= MAX_ATTEMPTS) {
            await db.query("UPDATE password_reset_otps SET used = TRUE WHERE id = ?", [record.id]);
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP.", code: "MAX_ATTEMPTS" });
        }

        const isMatch = await bcrypt.compare(otp, record.otp_hash);
        if (!isMatch) {
            await db.query("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?", [record.id]);
            const remaining = MAX_ATTEMPTS - record.attempts - 1;
            return res.status(400).json({
                message: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
                code: "INVALID_OTP",
                remaining,
            });
        }

        // OTP valid — return a short-lived reset token (do NOT mark as used yet; reset-password will do that)
        const resetToken = jwt.sign(
            { userId: record.user_id, email: normalizedEmail, otpId: record.id, purpose: "password_reset" },
            JWT_SECRET,
            { expiresIn: "15m" }
        );

        res.json({ message: "OTP verified.", resetToken });
    } catch (err) {
        console.error("[verify-otp] Error:", err.message);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// Step 2b — Resend OTP
app.post("/api/auth/resend-otp", validateResendOtp, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const normalizedEmail = email.trim().toLowerCase();

    if (!checkRateLimit(normalizedEmail)) {
        return res.status(429).json({ message: "Too many OTP requests. Please try again later." });
    }

    try {
        const [users] = await db.query("SELECT id, username FROM users WHERE email = ?", [normalizedEmail]);
        if (users.length === 0) return res.json({ message: "If this email is registered, an OTP has been sent." });

        const user = users[0];
        await db.query("UPDATE password_reset_otps SET used = TRUE WHERE user_id = ? AND used = FALSE", [user.id]);

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.query(
            "INSERT INTO password_reset_otps (user_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?)",
            [user.id, normalizedEmail, otpHash, expiresAt]
        );

        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            await sendOTPEmail(normalizedEmail, user.username, otp);
        } else {
            console.log(`[DEV MODE] Resent OTP for ${normalizedEmail}: ${otp}`);
        }

        res.json({ message: "A new OTP has been sent to your email." });
    } catch (err) {
        console.error("[resend-otp] Error:", err.message);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// Step 3 — Reset Password
app.post("/api/auth/reset-password", validateResetPassword, async (req, res) => {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ message: "Reset token and new password are required." });
    if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });

    try {
        let payload;
        try {
            payload = jwt.verify(resetToken, JWT_SECRET);
        } catch (e) {
            return res.status(400).json({ message: "Reset session has expired. Please start over.", code: "TOKEN_EXPIRED" });
        }

        if (payload.purpose !== "password_reset") return res.status(400).json({ message: "Invalid reset token." });

        // Confirm OTP record is still valid and unused
        const [rows] = await db.query(
            "SELECT * FROM password_reset_otps WHERE id = ? AND user_id = ? AND used = FALSE",
            [payload.otpId, payload.userId]
        );
        if (rows.length === 0) return res.status(400).json({ message: "This reset link has already been used. Please request a new one." });

        // Hash and update password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, payload.userId]);

        // Invalidate OTP record
        await db.query("UPDATE password_reset_otps SET used = TRUE WHERE id = ?", [payload.otpId]);

        res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (err) {
        console.error("[reset-password] Error:", err.message);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// Get current user

app.get("/api/auth/me", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, username, email, avatar, bio, created_at FROM users WHERE id = ?",
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: "User not found." });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update profile
app.put("/api/auth/profile", verifyToken, validateProfile, async (req, res) => {
    const { username, bio, avatar } = req.body;
    try {
        if (username && username !== req.user.username) {
            const [existing] = await db.query("SELECT id FROM users WHERE username = ? AND id != ?", [username, req.user.id]);
            if (existing.length > 0)
                return res.status(409).json({ message: "Username already taken." });
        }
        await db.query(
            "UPDATE users SET username = ?, bio = ?, avatar = ? WHERE id = ?",
            [username || req.user.username, bio || "", avatar || req.user.avatar, req.user.id]
        );
        const [updated] = await db.query("SELECT id, username, email, avatar, bio, is_online, last_seen FROM users WHERE id = ?", [req.user.id]);
        res.json({ message: "Profile updated.", user: updated[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Change Password (from settings)
app.put("/api/auth/change-password", verifyToken, validateChangePassword, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required." });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters long." });
    }

    try {
        // Get stored password
        const [rows] = await db.query("SELECT password FROM users WHERE id = ?", [req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const user = rows[0];
        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect current password." });
        }

        // Hash and update the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.user.id]);

        res.json({ message: "Password updated successfully." });
    } catch (err) {
        console.error("[change-password] Error:", err.message);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// Block User
app.post("/api/contacts/block", verifyToken, validateBlockUser, async (req, res) => {
    const { contactId } = req.body;
    const userId = Number(req.user.id);
    const targetId = Number(contactId);
    console.log(`[API] BLOCK REQUEST: User ${userId} blocking ${targetId}`);
    try {
        const [result] = await db.query("INSERT IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)", [userId, targetId]);
        console.log(`[API] BLOCK RESULT: rowCount=${result.affectedRows}`);
        res.json({ message: "User blocked" });
    } catch (err) {
        console.error("[API] block error:", err.message);
        res.status(500).json({ message: err.message });
    }
});

// Unblock User
app.post("/api/contacts/unblock", verifyToken, validateUnblockUser, async (req, res) => {
    const { contactId } = req.body;
    const userId = req.user.id;
    console.log(`[API] User ${userId} unblocking ${contactId}`);
    try {
        await db.query("DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?", [Number(userId), Number(contactId)]);
        res.json({ message: "User unblocked" });
    } catch (err) {
        console.error("[API] unblock error:", err.message);
        res.status(500).json({ message: err.message });
    }
});

// Get Block List
app.get("/api/contacts/blocked", verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const [rows] = await db.query("SELECT blocked_id FROM blocked_users WHERE blocker_id = ?", [userId]);
        res.json(rows.map(r => r.blocked_id));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// File Upload endpoint
app.post("/api/upload", verifyToken, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// Get active conversations (users with whom messages have been exchanged)
app.get("/api/contacts/active", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.username, u.avatar, u.bio, u.is_online, u.last_seen,
                    (SELECT COUNT(*) FROM messages m2 WHERE m2.sender_id = u.id AND m2.receiver_id = ? AND m2.is_read = 0) AS unread_count,
                    MAX(COALESCE(m.created_at, cl.created_at)) AS last_interaction
             FROM users u
             LEFT JOIN messages m ON ((u.id = m.sender_id AND m.receiver_id = ?) OR (u.id = m.receiver_id AND m.sender_id = ?))
             LEFT JOIN call_logs cl ON ((u.id = cl.caller_id AND cl.receiver_id = ?) OR (u.id = cl.receiver_id AND cl.caller_id = ?))
             WHERE (m.id IS NOT NULL OR cl.id IS NOT NULL)
               AND u.id != ?
             GROUP BY u.id, u.username, u.avatar, u.bio, u.is_online, u.last_seen
             ORDER BY last_interaction DESC`,
            [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Search users by username (excluding current user)
app.get("/api/contacts/search", verifyToken, async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.json([]);
    }
    try {
        const [rows] = await db.query(
            "SELECT id, username, avatar, bio, is_online, last_seen FROM users WHERE username LIKE ? AND id != ?",
            [`%${username}%`, req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get user profiles in batch
app.get("/api/users/batch", verifyToken, async (req, res) => {
    const { ids } = req.query;
    if (!ids) return res.json([]);
    const idArray = ids.split(",").map(Number).filter(Boolean);
    if (idArray.length === 0) return res.json([]);
    try {
        const [rows] = await db.query(
            "SELECT id, username, avatar FROM users WHERE id IN (?)",
            [idArray]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/api/messages/unread/total", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT COUNT(*) AS total FROM messages WHERE receiver_id = ? AND is_read = 0",
            [req.user.id]
        );
        res.json({ total: rows[0]?.total || 0 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────
app.get("/api/messages/:contactId", verifyToken, async (req, res) => {
    const { contactId } = req.params;
    const userId = req.user.id;
    try {
        const sql = `
            SELECT m.id, m.sender_id, m.receiver_id, m.message, m.is_read, m.created_at, 
                   u.username AS sender_name, u.avatar AS sender_avatar,
                   NULL AS call_type, NULL AS status, 0 AS duration_seconds, 0 AS is_call_event
            FROM messages m JOIN users u ON m.sender_id = u.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
            
            UNION ALL
            
            SELECT CONCAT('call_', cl.id) AS id, cl.caller_id AS sender_id, cl.receiver_id, 
                   '' AS message, 1 AS is_read, COALESCE(cl.ended_at, cl.created_at) AS created_at, 
                   u.username AS sender_name, u.avatar AS sender_avatar,
                   cl.call_type, cl.status, cl.duration_seconds, 1 AS is_call_event
            FROM call_logs cl JOIN users u ON cl.caller_id = u.id
            WHERE (cl.caller_id = ? AND cl.receiver_id = ?) OR (cl.caller_id = ? AND cl.receiver_id = ?)
            
            ORDER BY created_at ASC
        `;

        const [rows] = await db.query(sql, [
            userId, contactId, contactId, userId,
            userId, contactId, contactId, userId
        ]);

        // Mark unread messages sent TO the current user from this contact as read
        await db.query("UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0", [contactId, userId]);

        const formattedRows = rows.map(r => {
            if (r.is_call_event) {
                const isOutgoing = Number(r.sender_id) === Number(userId);
                const duration = r.duration_seconds > 0
                    ? ` · ${Math.floor(r.duration_seconds / 60)}m ${r.duration_seconds % 60}s`
                    : "";
                const label = `${r.call_type === "video" ? "📹" : "📞"} ${isOutgoing ? "Outgoing" : "Incoming"} ${r.call_type} call — ${r.status}${duration}`;

                return {
                    id: r.id,
                    sender_id: r.sender_id,
                    receiver_id: r.receiver_id,
                    message: label,
                    _isCallEvent: true,
                    _callStatus: r.status,
                    created_at: r.created_at,
                    sender_name: r.sender_name,
                    sender_avatar: r.sender_avatar
                };
            }
            return r;
        });

        res.json(formattedRows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete Entire Conversation
app.delete("/api/messages/:contactId", verifyToken, async (req, res) => {
    const { contactId } = req.params;
    const userId = req.user.id;
    try {
        await db.query(
            "DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
            [userId, contactId, contactId, userId]
        );
        // Also delete call logs for this contact if desired (user said "all chat conversation need to delete")
        await db.query(
            "DELETE FROM call_logs WHERE (caller_id = ? AND receiver_id = ?) OR (caller_id = ? AND receiver_id = ?)",
            [userId, contactId, contactId, userId]
        );
        res.json({ message: "Conversation deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// HTTP fallback for message saving (socket is primary)
app.post("/api/messages", verifyToken, validateSendMessage, async (req, res) => {
    const { receiver_id, message } = req.body;
    const sender_id = req.user.id;
    const rid = Number(receiver_id);
    const sid = Number(sender_id);

    if (!receiver_id || !message)
        return res.status(400).json({ message: "receiver_id and message required." });
    try {
        // Bi-directional Block Check
        const [blockCheck] = await db.query(
            "SELECT * FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
            [rid, sid, sid, rid]
        );
        if (blockCheck.length > 0) {
            const isBlockedByRecipient = blockCheck.some(r => r.blocker_id === rid);
            return res.status(403).json({
                message: isBlockedByRecipient ? "You are blocked by this user" : "You have blocked this user"
            });
        }

        const [result] = await db.query(
            "INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
            [sid, rid, message]
        );
        res.status(201).json({ id: result.insertId, sender_id: sid, receiver_id: rid, message });
    } catch (err) {
        console.error("[API] POST messages error:", err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── GROUPS ──────────────────────────────────────────────────────────────────
app.post("/api/groups", verifyToken, async (req, res) => {
    const { name, memberUsernames } = req.body;
    if (!name) return res.status(400).json({ message: "Group name required." });
    try {
        const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`;
        const [groupResult] = await db.query(
            "INSERT INTO groups_table (name, created_by, avatar) VALUES (?, ?, ?)",
            [name, req.user.id, avatarUrl]
        );
        const groupId = groupResult.insertId;

        // Add creator
        await db.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [groupId, req.user.id]);

        // Add members by username
        if (memberUsernames && memberUsernames.length > 0) {
            for (const uname of memberUsernames) {
                const [users] = await db.query("SELECT id FROM users WHERE username = ?", [uname]);
                if (users.length > 0) {
                    await db.query(
                        "INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)",
                        [groupId, users[0].id]
                    );
                }
            }
        }
        res.status(201).json({ id: groupId, name, avatar: avatarUrl });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/api/groups", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT g.* FROM groups_table g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?
       ORDER BY g.created_at DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/api/groups/:groupId/messages", verifyToken, async (req, res) => {
    const { groupId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT gm.*, u.username AS sender_name, u.avatar AS sender_avatar
       FROM group_messages gm JOIN users u ON gm.sender_id = u.id
       WHERE gm.group_id = ?
       ORDER BY gm.created_at ASC`,
            [groupId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get members of a group
app.get("/api/groups/:groupId/members", verifyToken, async (req, res) => {
    const { groupId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.username, u.avatar, u.bio, u.is_online, u.last_seen 
             FROM group_members gm
             JOIN users u ON gm.user_id = u.id
             WHERE gm.group_id = ?`,
            [groupId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add a new member to a group
app.post("/api/groups/:groupId/members", verifyToken, async (req, res) => {
    const { groupId } = req.params;
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: "Username is required" });
    }
    try {
        const [[user]] = await db.query("SELECT id, username, avatar FROM users WHERE username = ?", [username]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const [[existing]] = await db.query(
            "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
            [groupId, user.id]
        );
        if (existing) {
            return res.status(400).json({ message: "User is already in the group" });
        }

        await db.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [groupId, user.id]);

        res.json({
            message: "Member added successfully",
            user
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("PingMe Server is running."));

// ─── AGORA TOKEN ─────────────────────────────────────────────────────────────
app.post("/api/call/token", verifyToken, (req, res) => {

    const { channel, uid } = req.body;

    if (!channel || uid === undefined) {
        return res.status(400).json({
            message: "channel and uid required"
        });
    }

    try {

        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        const token = RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channel,
            Number(uid),
            RtcRole.PUBLISHER,
            privilegeExpiredTs,
            privilegeExpiredTs
        );

        return res.json({
            token,
            appId: AGORA_APP_ID
        });

    } catch (error) {

        console.error("Token generation error:", error);

        return res.status(500).json({
            message: "Failed to generate token",
            error: error.message
        });
    }

});
// ─── CALL LOGS ────────────────────────────────────────────────────────────────
// Create call log (when call starts)
app.post("/api/calls/log", verifyToken, async (req, res) => {
    const { receiver_id, call_type } = req.body;
    try {
        const [result] = await db.query(
            "INSERT INTO call_logs (caller_id, receiver_id, call_type, status) VALUES (?, ?, ?, 'calling')",
            [req.user.id, receiver_id, call_type]
        );
        res.status(201).json({ id: result.insertId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update call log (when call ends/declined)
app.patch("/api/calls/log/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    const { status, duration_seconds } = req.body; // status: 'accepted' | 'declined' | 'missed'
    try {
        await db.query(
            "UPDATE call_logs SET status = ?, duration_seconds = ?, ended_at = NOW() WHERE id = ?",
            [status, duration_seconds || 0, id]
        );
        // Fetch the full log row to emit to both parties (only for 1-on-1 calls)
        const [logs] = await db.query(
            `SELECT cl.*, 
                u1.username AS caller_name, u1.avatar AS caller_avatar,
                u2.username AS receiver_name, u2.avatar AS receiver_avatar
             FROM call_logs cl
             JOIN users u1 ON cl.caller_id = u1.id
             LEFT JOIN users u2 ON cl.receiver_id = u2.id
             WHERE cl.id = ?`,
            [id]
        );
        if (logs.length > 0 && logs[0].receiver_id) {
            // Emit call_ended so both parties update chat and history
            io.to(`user_${logs[0].caller_id}`).emit("call_log_updated", logs[0]);
            io.to(`user_${logs[0].receiver_id}`).emit("call_log_updated", logs[0]);
        }
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Join group call log (when user accepts call)
app.post("/api/calls/log/:id/join", verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(
            "INSERT IGNORE INTO call_participants (call_log_id, user_id) VALUES (?, ?)",
            [id, req.user.id]
        );
        res.status(200).json({ message: "Joined call" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get call history for current user
app.get("/api/calls/history", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT cl.*, 
                u1.username AS caller_name, u1.avatar AS caller_avatar,
                u2.username AS receiver_name, u2.avatar AS receiver_avatar,
                g.name AS group_name, g.avatar AS group_avatar
             FROM call_logs cl
             LEFT JOIN users u1 ON cl.caller_id = u1.id
             LEFT JOIN users u2 ON cl.receiver_id = u2.id
             LEFT JOIN groups_table g ON cl.group_id = g.id
             WHERE (cl.group_id IS NULL AND (cl.caller_id = ? OR cl.receiver_id = ?))
                OR (cl.group_id IS NOT NULL AND cl.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?))
             ORDER BY cl.created_at DESC
             LIMIT 100`,
            [req.user.id, req.user.id, req.user.id]
        );

        const callIds = rows.map(r => r.id);
        let participantsMap = {};
        if (callIds.length > 0) {
            const [participants] = await db.query(
                `SELECT cp.call_log_id, u.id, u.username, u.avatar 
                 FROM call_participants cp
                 JOIN users u ON cp.user_id = u.id
                 WHERE cp.call_log_id IN (${callIds.map(() => "?").join(",")})`,
                callIds
            );
            participants.forEach(p => {
                if (!participantsMap[p.call_log_id]) {
                    participantsMap[p.call_log_id] = [];
                }
                participantsMap[p.call_log_id].push({
                    id: p.id,
                    username: p.username,
                    avatar: p.avatar
                });
            });
        }
        
        const result = rows.map(r => ({
            ...r,
            participants: participantsMap[r.id] || []
        }));
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

server.listen(PORT, "0.0.0.0", () => console.log(`PingMe server running on port ${PORT}`));
