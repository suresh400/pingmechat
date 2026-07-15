const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "chatapp_secret_key_2024";

const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token." });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.email === "admin@pingme.chat") {
        next();
    } else {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
};

module.exports = { verifyToken, isAdmin, JWT_SECRET };
