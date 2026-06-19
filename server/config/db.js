const mysql = require("mysql2");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "chatapp",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const db = pool.promise();

const initDB = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(500) DEFAULT NULL,
        bio VARCHAR(255) DEFAULT 'Hey there! I am using PingMe.',
        is_online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
      )
    `);

    // Migration: Add is_read to messages if missing
    try {
      const [cols] = await db.query("SHOW COLUMNS FROM messages LIKE 'is_read'");
      if (cols.length === 0) {
        await db.query("ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE AFTER message");
        console.log("[Migration] Added missing is_read column to messages table.");
      }
    } catch (migErr) {
      console.error("[Migration Error]", migErr.message);
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS groups_table (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_by INT NOT NULL,
        avatar VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES groups_table(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        sender_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups_table(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caller_id INT NOT NULL,
        receiver_id INT NULL,
        group_id INT NULL,
        call_type ENUM('audio','video') NOT NULL,
        status ENUM('calling','accepted','declined','missed') DEFAULT 'calling',
        duration_seconds INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        FOREIGN KEY (caller_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id),
        FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE
      )
    `);

    // Migration for call_logs if already existing
    try {
        await db.query("ALTER TABLE call_logs MODIFY COLUMN receiver_id INT NULL");
    } catch (e) {
        console.log("[Migration] receiver_id modification bypassed:", e.message);
    }
    try {
        await db.query("ALTER TABLE call_logs ADD COLUMN group_id INT NULL AFTER receiver_id");
        await db.query("ALTER TABLE call_logs ADD CONSTRAINT fk_call_logs_group FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE");
    } catch (e) {
        // Already exists
    }

    // Create call_participants table
    await db.query(`
      CREATE TABLE IF NOT EXISTS call_participants (
        call_log_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (call_log_id, user_id),
        FOREIGN KEY (call_log_id) REFERENCES call_logs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT DEFAULT 0,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        blocker_id INT NOT NULL,
        blocked_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (blocker_id, blocked_id),
        FOREIGN KEY (blocker_id) REFERENCES users(id),
        FOREIGN KEY (blocked_id) REFERENCES users(id)
      )
    `);
    console.log("Database tables initialized successfully.");
  } catch (err) {
    console.error("Error initializing DB:", err.message);
  }
};

pool.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", err.message);
  } else {
    console.log("Connected to MySQL database.");
    connection.release();
    initDB();
  }
});

module.exports = db;
