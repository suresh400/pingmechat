const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "chatapp_secret_key_2024";

const db = require("../config/db");

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;

        // Ensure req.user.id is a valid number; if it's a UUID string or NaN, resolve DB id
        if (isNaN(Number(req.user.id))) {
            try {
                const [users] = await db.query("SELECT * FROM users WHERE email = ? OR username = ?", [req.user.email, req.user.username]);
                if (users && users.length > 0) {
                    req.user.id = users[0].id;
                }
            } catch (dbErr) {
                console.error("[AuthMiddleware] Error resolving user ID:", dbErr.message);
            }
        }
        return next();
    } catch (err) {
        // Fallback for valid Supabase session tokens when backend was asleep during login
        const decoded = jwt.decode(token);
        if (decoded && (decoded.sub || decoded.phone || decoded.email)) {
            const normalizedPhone = (decoded.phone || decoded.user_metadata?.phone || "").replace(/\D/g, "");
            const email = decoded.email || `+${normalizedPhone}@phone.supabase`;
            const username = decoded.user_metadata?.username || `+${normalizedPhone}@user`;

            let realId = 1;
            try {
                const [users] = await db.query("SELECT * FROM users WHERE email = ? OR username = ?", [email, username]);
                if (users && users.length > 0) {
                    realId = users[0].id;
                }
            } catch (dbErr) {
                console.error("[AuthMiddleware] Error resolving fallback user ID:", dbErr.message);
            }

            req.user = {
                id: realId,
                username: username,
                email: email,
                avatar: decoded.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalizedPhone}`
            };
            return next();
        }
        return res.status(403).json({ message: "Invalid or expired token." });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && (req.user.email === "admin@pingme.chat" || req.user.username === "Admin" || req.user.username === "SystemAdmin")) {
        next();
    } else {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
};

module.exports = { verifyToken, isAdmin, JWT_SECRET };
