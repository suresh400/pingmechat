/**
 * db.js — Mongoose/MongoDB Atlas version.
 * Exposes the same db.query(sql, params) -> [[rows], fields] interface to index.js.
 * Automatically migrates existing local db.json data on startup.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Ensure environment variables are loaded
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("[DB] MONGODB_URI is not set in .env!");
} else {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log("[DB] Connected to MongoDB Atlas successfully via Mongoose"))
    .catch(err => console.error("[DB] MongoDB connection error:", err.message));
}

// ── Schemas & Models ─────────────────────────────────────────────────────────

const CounterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model("Counter", CounterSchema);

async function nextId(seqName) {
  const counter = await Counter.findByIdAndUpdate(
    seqName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

const UserSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: { type: String },
  avatar: { type: String },
  bio: { type: String, default: "Hey there! I am using PingMe." },
  show_email: { type: Boolean, default: true },
  is_online: { type: Number, default: 0 },
  last_seen: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
});
const User = mongoose.model("User", UserSchema);

const MessageSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  sender_id: { type: Number },
  receiver_id: { type: Number },
  message: { type: String },
  is_read: { type: Boolean, default: false },
  self_destruct_seconds: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", MessageSchema);

const GroupSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String },
  created_by: { type: Number },
  avatar: { type: String },
  created_at: { type: Date, default: Date.now }
});
const Group = mongoose.model("Group", GroupSchema);

const GroupMemberSchema = new mongoose.Schema({
  group_id: { type: Number },
  user_id: { type: Number },
  joined_at: { type: Date, default: Date.now }
});
GroupMemberSchema.index({ group_id: 1, user_id: 1 }, { unique: true });
const GroupMember = mongoose.model("GroupMember", GroupMemberSchema);

const GroupMessageSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  group_id: { type: Number },
  sender_id: { type: Number },
  message: { type: String },
  self_destruct_seconds: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});
const GroupMessage = mongoose.model("GroupMessage", GroupMessageSchema);

const CallLogSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  caller_id: { type: Number },
  receiver_id: { type: Number },
  group_id: { type: Number },
  call_type: { type: String },
  status: { type: String },
  duration_seconds: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  ended_at: { type: Date }
});
const CallLog = mongoose.model("CallLog", CallLogSchema);

const CallParticipantSchema = new mongoose.Schema({
  call_log_id: { type: Number },
  user_id: { type: Number },
  joined_at: { type: Date, default: Date.now }
});
CallParticipantSchema.index({ call_log_id: 1, user_id: 1 }, { unique: true });
const CallParticipant = mongoose.model("CallParticipant", CallParticipantSchema);

const OtpSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  user_id: { type: Number },
  email: { type: String },
  otp_hash: { type: String },
  expires_at: { type: Date },
  attempts: { type: Number, default: 0 },
  used: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});
const Otp = mongoose.model("Otp", OtpSchema);

const BlockedUserSchema = new mongoose.Schema({
  blocker_id: { type: Number },
  blocked_id: { type: Number },
  created_at: { type: Date, default: Date.now }
});
BlockedUserSchema.index({ blocker_id: 1, blocked_id: 1 }, { unique: true });
const BlockedUser = mongoose.model("BlockedUser", BlockedUserSchema);

const FeedbackSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  user_id: { type: Number },
  rating: { type: Number },
  working_well: { type: String },
  needs_change: { type: String },
  submitted_at: { type: Date, default: Date.now }
});
const Feedback = mongoose.model("Feedback", FeedbackSchema);

const AttachmentSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  filename: { type: String, unique: true },
  mime_type: { type: String },
  url: { type: String },
  created_at: { type: Date, default: Date.now }
});
const Attachment = mongoose.model("Attachment", AttachmentSchema);

const TaskSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  chat_id: { type: String }, // Can be group_id or private contact_id string
  title: { type: String },
  description: { type: String },
  status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
  assigned_to: { type: Number, default: null }, // User ID
  created_at: { type: Date, default: Date.now }
});
const Task = mongoose.model("Task", TaskSchema);

// ── Migration / Seed from db.json ──────────────────────────────────────────

const seedIfEmpty = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log("[DB] MongoDB Atlas has existing data, skipping migration.");
      return;
    }

    const DATA_FILE = path.join(__dirname, "..", "data", "db.json");
    if (!fs.existsSync(DATA_FILE)) {
      console.log("[DB] No local db.json found to migrate.");
      return;
    }

    console.log("[DB] MongoDB Atlas is empty. Seeding from local db.json...");
    const localStore = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (localStore.counters) {
      for (const [key, val] of Object.entries(localStore.counters)) {
        await Counter.findByIdAndUpdate(key, { seq: val }, { upsert: true });
      }
    }

    if (localStore.users && localStore.users.length > 0) {
      await User.insertMany(localStore.users);
      console.log(`[DB] Seeded ${localStore.users.length} users`);
    }

    if (localStore.messages && localStore.messages.length > 0) {
      await Message.insertMany(localStore.messages);
      console.log(`[DB] Seeded ${localStore.messages.length} messages`);
    }

    if (localStore.groups_table && localStore.groups_table.length > 0) {
      await Group.insertMany(localStore.groups_table.map(g => ({
        id: g.id,
        name: g.name,
        created_by: g.created_by,
        avatar: g.avatar,
        created_at: g.created_at
      })));
      console.log(`[DB] Seeded ${localStore.groups_table.length} groups`);
    }

    if (localStore.group_members && localStore.group_members.length > 0) {
      await GroupMember.insertMany(localStore.group_members);
      console.log(`[DB] Seeded ${localStore.group_members.length} group members`);
    }

    if (localStore.group_messages && localStore.group_messages.length > 0) {
      await GroupMessage.insertMany(localStore.group_messages);
      console.log(`[DB] Seeded ${localStore.group_messages.length} group messages`);
    }

    if (localStore.call_logs && localStore.call_logs.length > 0) {
      await CallLog.insertMany(localStore.call_logs);
      console.log(`[DB] Seeded ${localStore.call_logs.length} call logs`);
    }

    if (localStore.call_participants && localStore.call_participants.length > 0) {
      await CallParticipant.insertMany(localStore.call_participants);
      console.log(`[DB] Seeded ${localStore.call_participants.length} call participants`);
    }

    if (localStore.password_reset_otps && localStore.password_reset_otps.length > 0) {
      await Otp.insertMany(localStore.password_reset_otps);
      console.log(`[DB] Seeded ${localStore.password_reset_otps.length} OTP records`);
    }

    if (localStore.blocked_users && localStore.blocked_users.length > 0) {
      await BlockedUser.insertMany(localStore.blocked_users);
      console.log(`[DB] Seeded ${localStore.blocked_users.length} blocked users`);
    }

    console.log("[DB] Migration completed successfully!");
  } catch (err) {
    console.error("[DB] Seeding/Migration failed:", err.message);
  }
};

mongoose.connection.once("open", () => {
  seedIfEmpty();
});

// ── SQL-to-MongoDB Complex Queries ──────────────────────────────────────────

async function activeContacts(userId) {
  const uid = Number(userId);
  const messages = await Message.find({ $or: [{ sender_id: uid }, { receiver_id: uid }] }).lean();
  const callLogs = await CallLog.find({ group_id: null, $or: [{ caller_id: uid }, { receiver_id: uid }] }).lean();

  const seen = new Map();
  for (const m of messages) {
    const other = m.sender_id === uid ? m.receiver_id : m.receiver_id === uid ? m.sender_id : null;
    if (!other || other === uid) continue;
    const prev = seen.get(other);
    if (!prev || new Date(m.created_at) > new Date(prev)) seen.set(other, m.created_at);
  }
  for (const cl of callLogs) {
    const other = cl.caller_id === uid ? cl.receiver_id : cl.receiver_id === uid ? cl.caller_id : null;
    if (!other || other === uid) continue;
    const ts = cl.ended_at || cl.created_at;
    const prev = seen.get(other);
    if (!prev || new Date(ts) > new Date(prev)) seen.set(other, ts);
  }

  const results = [];
  for (const [otherId, lastTs] of seen.entries()) {
    const u = await User.findOne({ id: otherId }).lean();
    if (!u) continue;
    const unread = await Message.countDocuments({ sender_id: otherId, receiver_id: uid, is_read: false });
    results.push({
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      bio: u.bio,
      is_online: u.is_online || 0,
      last_seen: u.last_seen,
      unread_count: unread,
      last_interaction: lastTs
    });
  }
  return results.sort((a, b) => new Date(b.last_interaction) - new Date(a.last_interaction));
}

async function messageHistory(uid, cid) {
  const u = Number(uid);
  const c = Number(cid);

  if (isNaN(u) || isNaN(c)) {
    return [];
  }

  // Clean up expired self-destruct direct messages on the fly
  const now = Date.now();
  try {
    const expiredDirect = await Message.find({
      self_destruct_seconds: { $gt: 0 },
      $or: [
        { sender_id: u, receiver_id: c },
        { sender_id: c, receiver_id: u }
      ]
    }).lean();
    for (const m of expiredDirect) {
      const expiry = new Date(m.created_at).getTime() + m.self_destruct_seconds * 1000;
      if (expiry < now) {
        await Message.deleteOne({ id: m.id });
      }
    }
  } catch (err) {
    console.error("[SelfDestruct] Error cleaning expired direct messages on-the-fly:", err);
  }

  const messages = await Message.find({
    $or: [
      { sender_id: u, receiver_id: c },
      { sender_id: c, receiver_id: u }
    ]
  }).lean();

  const callLogs = await CallLog.find({
    group_id: null,
    $or: [
      { caller_id: u, receiver_id: c },
      { caller_id: c, receiver_id: u }
    ]
  }).lean();

  const formattedMessages = [];
  for (const m of messages) {
    const sender = await User.findOne({ id: m.sender_id }).lean();
    formattedMessages.push({
      ...m,
      sender_name: sender ? sender.username : "",
      sender_avatar: sender ? sender.avatar : "",
      call_type: null,
      status: null,
      duration_seconds: 0,
      is_call_event: 0
    });
  }

  for (const cl of callLogs) {
    const sender = await User.findOne({ id: cl.caller_id }).lean();
    formattedMessages.push({
      id: `call_${cl.id}`,
      sender_id: cl.caller_id,
      receiver_id: cl.receiver_id,
      message: "",
      is_read: true,
      created_at: cl.ended_at || cl.created_at,
      sender_name: sender ? sender.username : "",
      sender_avatar: sender ? sender.avatar : "",
      call_type: cl.call_type,
      status: cl.status,
      duration_seconds: cl.duration_seconds || 0,
      is_call_event: 1
    });
  }

  return formattedMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

async function callLogWithUsers(id) {
  const cl = await CallLog.findOne({ id: Number(id) }).lean();
  if (!cl) return [];
  const u1 = await User.findOne({ id: cl.caller_id }).lean() || {};
  const u2 = cl.receiver_id ? (await User.findOne({ id: cl.receiver_id }).lean() || {}) : null;
  const g = cl.group_id ? await Group.findOne({ id: cl.group_id }).lean() : null;
  return [{
    ...cl,
    caller_name: u1.username,
    caller_avatar: u1.avatar,
    receiver_name: u2?.username,
    receiver_avatar: u2?.avatar,
    group_name: g?.name,
    group_avatar: g?.avatar
  }];
}

async function callHistory(userId) {
  const uid = Number(userId);
  const myGroupMemberships = await GroupMember.find({ user_id: uid }).lean();
  const myGroups = myGroupMemberships.map(m => m.group_id);

  const logs = await CallLog.find({
    $or: [
      { group_id: null, caller_id: uid },
      { group_id: null, receiver_id: uid },
      { group_id: { $in: myGroups } }
    ]
  }).sort({ created_at: -1 }).limit(100).lean();

  const results = [];
  for (const cl of logs) {
    const u1 = await User.findOne({ id: cl.caller_id }).lean() || {};
    const u2 = cl.receiver_id ? (await User.findOne({ id: cl.receiver_id }).lean() || {}) : null;
    const g = cl.group_id ? await Group.findOne({ id: cl.group_id }).lean() : null;
    results.push({
      ...cl,
      caller_name: u1.username,
      caller_avatar: u1.avatar,
      receiver_name: u2?.username,
      receiver_avatar: u2?.avatar,
      group_name: g?.name,
      group_avatar: g?.avatar
    });
  }
  return results;
}

// ── SQL-to-MongoDB SELECT Handler ───────────────────────────────────────────

async function handleSelect(sl, p) {
  const R = rows => [rows];

  if (sl.includes("unread_count") && sl.includes("last_interaction")) return R(await activeContacts(p[0]));
  if (sl.includes("union all") && sl.includes("is_call_event"))       return R(await messageHistory(p[0], p[1]));
  if (sl.includes("group_name") && sl.includes("limit 100"))          return R(await callHistory(p[0]));
  if (sl.includes("caller_name") && sl.includes("from call_logs"))    return R(await callLogWithUsers(p[0]));

  if (sl.includes("select group_id from call_logs")) {
    const cl = await CallLog.findOne({ id: Number(p[0]) }).lean();
    return R(cl ? [{ group_id: cl.group_id }] : []);
  }

  if (sl.includes("from call_participants") && sl.includes("join users")) {
    const ids = p.map(Number);
    const participants = await CallParticipant.find({ call_log_id: { $in: ids } }).lean();
    const results = [];
    for (const cp of participants) {
      const u = await User.findOne({ id: cp.user_id }).lean();
      if (u) {
        results.push({ call_log_id: cp.call_log_id, id: u.id, username: u.username, avatar: u.avatar });
      }
    }
    return R(results);
  }

  // users
  if (/select \* from users where email/.test(sl))                      return R(await User.find({ email: p[0] }).lean());
  if (/select id, username from users where email/.test(sl))            return R(await User.find({ email: p[0] }).select("id username").lean());
  if (/select id from users where email/.test(sl))                      return R(await User.find({ email: p[0] }).select("id").lean());
  if (/select id from users where username/.test(sl) && sl.includes("and id !=")) return R(await User.find({ username: p[0], id: { $ne: Number(p[1]) } }).select("id").lean());
  if (/select id from users where username/.test(sl))                   return R(await User.find({ username: p[0] }).select("id").lean());
  if (/select password from users/.test(sl))                            return R(await User.find({ id: Number(p[0]) }).select("password").lean());
  if (/select id, username, avatar from users where username/.test(sl)) return R(await User.find({ username: p[0] }).select("id username avatar").lean());

  if (sl.includes("from users where id in")) {
    const ids = p.flat().map(Number);
    return R(await User.find({ id: { $in: ids } }).select("id username avatar").lean());
  }

  if (sl.includes("like") && sl.includes("from users")) {
    const term = p[0].replace(/%/g, "");
    const excl = Number(p[1]);
    return R(await User.find({
      username: { $regex: new RegExp(term, "i") },
      id: { $ne: excl }
    }).select("id username avatar bio is_online last_seen").lean());
  }

  if (sl.includes("username, email, avatar from users where id")) {
    const u = await User.findOne({ id: Number(p[0]) }).lean();
    if (!u) return R([]);
    return R([{ username: u.username, email: u.email, avatar: u.avatar }]);
  }

  if (sl.includes("created_at from users where id")) {
    const u = await User.findOne({ id: Number(p[0]) }).lean();
    if (!u) return R([]);
    return R([{ id: u.id, username: u.username, email: u.email, avatar: u.avatar, bio: u.bio, show_email: u.show_email !== false, created_at: u.created_at }]);
  }

  if (sl.includes("last_seen from users where id")) {
    const u = await User.findOne({ id: Number(p[0]) }).lean();
    if (!u) return R([]);
    return R([{ id: u.id, username: u.username, email: u.email, avatar: u.avatar, bio: u.bio, show_email: u.show_email !== false, is_online: u.is_online, last_seen: u.last_seen }]);
  }

  // Full public profile for a single user
  if (sl.includes("show_email from users where id")) {
    const u = await User.findOne({ id: Number(p[0]) }).lean();
    if (!u) return R([]);
    return R([{ id: u.id, username: u.username, email: u.email, avatar: u.avatar, bio: u.bio, show_email: u.show_email !== false, is_online: u.is_online, last_seen: u.last_seen }]);
  }

  if (sl.includes("count(*) as total from users")) {
    const total = await User.countDocuments();
    return R([{ total }]);
  }

  // messages
  if (sl.includes("count(*) as total from messages")) {
    const total = await Message.countDocuments({ receiver_id: Number(p[0]), is_read: false });
    return R([{ total }]);
  }

  // blocked
  if (sl.includes("select blocked_id from blocked_users")) {
    const rows = await BlockedUser.find({ blocker_id: Number(p[0]) }).select("blocked_id").lean();
    return R(rows);
  }
  if (sl.includes("from blocked_users")) {
    const rows = await BlockedUser.find({
      $or: [
        { blocker_id: Number(p[0]), blocked_id: Number(p[1]) },
        { blocker_id: Number(p[2]), blocked_id: Number(p[3]) }
      ]
    }).lean();
    return R(rows);
  }

  // groups
  if (sl.includes("from groups_table g") && sl.includes("join group_members")) {
    const memberships = await GroupMember.find({ user_id: Number(p[0]) }).lean();
    const gids = memberships.map(m => m.group_id);
    const groups = await Group.find({ id: { $in: gids } }).sort({ created_at: -1 }).lean();
    return R(groups);
  }

  if (/select \* from groups_table where id/.test(sl)) {
    return R(await Group.find({ id: Number(p[0]) }).lean());
  }

  if (sl.includes("from group_messages") && sl.includes("join users")) {
    const groupId = Number(p[0]);
    // Clean up expired group messages on the fly
    const now = Date.now();
    try {
      const expiredGroup = await GroupMessage.find({
        group_id: groupId,
        self_destruct_seconds: { $gt: 0 }
      }).lean();
      for (const m of expiredGroup) {
        const expiry = new Date(m.created_at).getTime() + m.self_destruct_seconds * 1000;
        if (expiry < now) {
          await GroupMessage.deleteOne({ id: m.id });
        }
      }
    } catch (err) {
      console.error("[SelfDestruct] Error cleaning expired group messages on-the-fly:", err);
    }

    const msgs = await GroupMessage.find({ group_id: groupId }).lean();
    const results = [];
    for (const m of msgs) {
      const u = await User.findOne({ id: m.sender_id }).lean() || {};
      results.push({ ...m, sender_name: u.username, sender_avatar: u.avatar });
    }
    return R(results.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
  }

  if (sl.includes("select user_id from group_members where group_id")) {
    const rows = await GroupMember.find({ group_id: Number(p[0]) }).select("user_id").lean();
    return R(rows);
  }

  if (sl.includes("from group_members gm") && sl.includes("join users")) {
    const members = await GroupMember.find({ group_id: Number(p[0]) }).lean();
    const uids = members.map(m => m.user_id);
    const users = await User.find({ id: { $in: uids } }).select("id username avatar bio is_online last_seen").lean();
    return R(users);
  }

  if (/select \* from group_members where group_id/.test(sl) && sl.includes("and user_id")) {
    return R(await GroupMember.find({ group_id: Number(p[0]), user_id: Number(p[1]) }).lean());
  }

  // OTPs
  if (sl.includes("from password_reset_otps") && sl.includes("limit 1")) {
    const rec = await Otp.findOne({ email: p[0], used: false }).sort({ created_at: -1 }).lean();
    return R(rec ? [rec] : []);
  }
  if (sl.includes("from password_reset_otps") && sl.includes("and user_id")) {
    return R(await Otp.find({ id: Number(p[0]), user_id: Number(p[1]), used: false }).lean());
  }

  if (sl.includes("from feedback")) {
    return R(await Feedback.find({ user_id: Number(p[0]) }).lean());
  }

  throw new Error(`[DB] Unhandled SELECT: ${sl.substring(0, 120)}`);
}

// ── SQL-to-MongoDB INSERT Handler ───────────────────────────────────────────

async function handleInsert(sl, p) {
  if (sl.includes("into users")) {
    const id = await nextId("users");
    const user = new User({
      id,
      username: p[0],
      email: p[1],
      password: p[2],
      avatar: p[3],
      bio: "Hey there! I am using PingMe.",
      is_online: 0,
      last_seen: new Date(),
      created_at: new Date()
    });
    await user.save();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (sl.includes("into feedback")) {
    const id = await nextId("feedback");
    const feedback = new Feedback({
      id,
      user_id: Number(p[0]),
      rating: Number(p[1]),
      working_well: p[2],
      needs_change: p[3],
      submitted_at: new Date()
    });
    await feedback.save();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (sl.includes("into messages")) {
    const id = await nextId("messages");
    const message = new Message({
      id,
      sender_id: Number(p[0]),
      receiver_id: Number(p[1]),
      message: p[2],
      is_read: false,
      self_destruct_seconds: p[3] !== undefined ? Number(p[3]) : 0,
      created_at: new Date()
    });
    await message.save();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (sl.includes("into group_messages")) {
    const id = await nextId("group_messages");
    const msg = new GroupMessage({
      id,
      group_id: Number(p[0]),
      sender_id: Number(p[1]),
      message: p[2],
      self_destruct_seconds: p[3] !== undefined ? Number(p[3]) : 0,
      created_at: new Date()
    });
    await msg.save();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (sl.includes("into groups_table")) {
    const id = await nextId("groups");
    const group = new Group({
      id,
      name: p[0],
      created_by: Number(p[1]),
      avatar: p[2],
      created_at: new Date()
    });
    await group.save();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (sl.includes("into group_members")) {
    const gid = Number(p[0]);
    const uid = Number(p[1]);
    const exists = await GroupMember.findOne({ group_id: gid, user_id: uid });
    if (exists && sl.includes("insert ignore")) return [{ affectedRows: 0 }];

    const gm = new GroupMember({ group_id: gid, user_id: uid, joined_at: new Date() });
    await gm.save();
    return [{ affectedRows: 1 }];
  }

  if (sl.includes("into call_logs")) {
    const id = await nextId("call_logs");
    let entry;
    if (sl.includes("group_id")) {
      entry = new CallLog({
        id,
        caller_id: Number(p[0]),
        group_id: Number(p[1]),
        call_type: p[2],
        status: "calling",
        duration_seconds: 0,
        created_at: new Date(),
        ended_at: null
      });
    } else {
      entry = new CallLog({
        id,
        caller_id: Number(p[0]),
        receiver_id: Number(p[1]),
        call_type: p[2],
        status: "calling",
        duration_seconds: 0,
        created_at: new Date(),
        ended_at: null
      });
    }
    await entry.save();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (sl.includes("into call_participants")) {
    const cid = Number(p[0]);
    const uid = Number(p[1]);
    const exists = await CallParticipant.findOne({ call_log_id: cid, user_id: uid });
    if (exists && sl.includes("insert ignore")) return [{ affectedRows: 0 }];

    const cp = new CallParticipant({ call_log_id: cid, user_id: uid, joined_at: new Date() });
    await cp.save();
    return [{ affectedRows: 1 }];
  }

  if (sl.includes("into password_reset_otps")) {
    const id = await nextId("otps");
    const otp = new Otp({
      id,
      user_id: Number(p[0]),
      email: p[1],
      otp_hash: p[2],
      expires_at: new Date(p[3]),
      attempts: 0,
      used: false,
      created_at: new Date()
    });
    await otp.save();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (sl.includes("into blocked_users")) {
    const bid = Number(p[0]);
    const blkid = Number(p[1]);
    const exists = await BlockedUser.findOne({ blocker_id: bid, blocked_id: blkid });
    if (exists && sl.includes("insert ignore")) return [{ affectedRows: 0 }];

    const bu = new BlockedUser({ blocker_id: bid, blocked_id: blkid, created_at: new Date() });
    await bu.save();
    return [{ affectedRows: 1 }];
  }

  throw new Error(`[DB] Unhandled INSERT: ${sl.substring(0, 100)}`);
}

// ── SQL-to-MongoDB UPDATE Handler ───────────────────────────────────────────

async function handleUpdate(sl, p) {
  if (sl.includes("update users set is_online = 0") && !sl.includes("where")) {
    const res = await User.updateMany({}, { is_online: 0 });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update users set is_online = 1")) {
    const res = await User.updateOne({ id: Number(p[0]) }, { is_online: 1 });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update users set is_online = 0, last_seen")) {
    const res = await User.updateOne({ id: Number(p[0]) }, { is_online: 0, last_seen: new Date() });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update users set username") && sl.includes("bio") && sl.includes("avatar")) {
    // Use $set explicitly so empty string bio is saved (not treated as falsy)
    const res = await User.updateOne(
      { id: Number(p[3]) },
      { $set: { username: p[0], bio: p[1] !== undefined ? p[1] : "", avatar: p[2] } }
    );
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update users set show_email")) {
    const res = await User.updateOne({ id: Number(p[1]) }, { $set: { show_email: Boolean(p[0]) } });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update users set password") && sl.includes("where id")) {
    const res = await User.updateOne({ id: Number(p[1]) }, { password: p[0] });
    return [{ affectedRows: res.modifiedCount }];
  }

  if (sl.includes("update messages set is_read = 1 where id")) {
    const res = await Message.updateOne({ id: Number(p[0]) }, { is_read: true });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update messages set is_read = 1 where sender_id")) {
    const res = await Message.updateMany({ sender_id: Number(p[0]), receiver_id: Number(p[1]), is_read: false }, { is_read: true });
    return [{ affectedRows: res.modifiedCount }];
  }

  if (sl.includes("update password_reset_otps set used = true where email") && sl.includes("and used = false")) {
    const res = await Otp.updateMany({ email: p[0], used: false }, { used: true });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update password_reset_otps set used = true where user_id")) {
    const res = await Otp.updateMany({ user_id: Number(p[0]), used: false }, { used: true });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update password_reset_otps set used = true where id")) {
    const res = await Otp.updateOne({ id: Number(p[0]) }, { used: true });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update password_reset_otps set attempts = attempts + 1")) {
    const res = await Otp.updateOne({ id: Number(p[0]) }, { $inc: { attempts: 1 } });
    return [{ affectedRows: res.modifiedCount }];
  }

  if (sl.includes("update call_logs") && sl.includes("group_id") && sl.includes("caller_id") && sl.includes("'missed'")) {
    const res = await CallLog.updateMany({ group_id: Number(p[0]), caller_id: Number(p[1]), status: "calling" }, { status: "missed", ended_at: new Date() });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("update call_logs") && sl.includes("'accepted'") && sl.includes("and status = 'calling'")) {
    const res = await CallLog.updateOne({ id: Number(p[0]), status: "calling" }, { status: "accepted", ended_at: new Date() });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("set status='missed'")) {
    const res = await CallLog.updateOne({ id: Number(p[0]) }, { status: "missed", ended_at: new Date() });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("set status='declined'")) {
    const res = await CallLog.updateOne({ id: Number(p[0]) }, { status: "declined", ended_at: new Date() });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("set status='accepted'")) {
    const res = await CallLog.updateOne({ id: Number(p[0]) }, { status: "accepted" });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("set status = ?, duration_seconds")) {
    const res = await CallLog.updateOne({ id: Number(p[2]) }, { status: p[0], duration_seconds: Number(p[1]), ended_at: new Date() });
    return [{ affectedRows: res.modifiedCount }];
  }
  if (sl.includes("set status = 'accepted', duration_seconds")) {
    const res = await CallLog.updateOne({ id: Number(p[1]) }, { status: "accepted", duration_seconds: Number(p[0]), ended_at: new Date() });
    return [{ affectedRows: res.modifiedCount }];
  }

  throw new Error(`[DB] Unhandled UPDATE: ${sl.substring(0, 120)}`);
}

// ── SQL-to-MongoDB DELETE Handler ───────────────────────────────────────────

async function handleDelete(sl, p) {
  if (sl.includes("from messages")) {
    const u = Number(p[0]);
    const c = Number(p[1]);
    const res = await Message.deleteMany({
      $or: [
        { sender_id: u, receiver_id: c },
        { sender_id: c, receiver_id: u }
      ]
    });
    return [{ affectedRows: res.deletedCount }];
  }
  if (sl.includes("from call_logs")) {
    const u = Number(p[0]);
    const c = Number(p[1]);
    const res = await CallLog.deleteMany({
      group_id: null,
      $or: [
        { caller_id: u, receiver_id: c },
        { caller_id: c, receiver_id: u }
      ]
    });
    return [{ affectedRows: res.deletedCount }];
  }
  if (sl.includes("from blocked_users")) {
    const res = await BlockedUser.deleteOne({ blocker_id: Number(p[0]), blocked_id: Number(p[1]) });
    return [{ affectedRows: res.deletedCount }];
  }
  throw new Error(`[DB] Unhandled DELETE: ${sl.substring(0, 100)}`);
}

// ── Expose same query interface ─────────────────────────────────────────────

const db = {
  query: async (sql, params = []) => {
    const sl = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (sl.startsWith("create table") || sl.startsWith("alter table")) return [{ affectedRows: 0 }];
    if (sl.startsWith("show columns")) return [[{ Field: "is_read" }]];
    if (sl.startsWith("select")) return await handleSelect(sl, params);
    if (sl.startsWith("insert")) return await handleInsert(sl, params);
    if (sl.startsWith("update")) return await handleUpdate(sl, params);
    if (sl.startsWith("delete")) return await handleDelete(sl, params);
    throw new Error(`[DB] Unsupported: ${sl.substring(0, 80)}`);
  },
  saveAttachment: async (filename, mimeType, url) => {
    try {
      const id = await nextId("attachments");
      await Attachment.updateOne(
        { filename },
        { id, filename, mime_type: mimeType, url },
        { upsert: true }
      );
      console.log(`[DB] Attachment reference ${filename} -> ${url} saved to MongoDB successfully.`);
    } catch (err) {
      console.error("[DB] Error saving attachment URL to MongoDB:", err);
      throw err;
    }
  },
  getAttachment: async (filename) => {
    try {
      return await Attachment.findOne({ filename }).lean();
    } catch (err) {
      console.error("[DB] Error fetching attachment from MongoDB:", err);
      return null;
    }
  },
  getTasks: async (chatId) => {
    try {
      return await Task.find({ chat_id: String(chatId) }).sort({ created_at: 1 }).lean();
    } catch (err) {
      console.error("[DB] Error fetching tasks:", err);
      return [];
    }
  },
  saveTask: async (taskData) => {
    try {
      const id = await nextId("tasks");
      const task = new Task({ id, ...taskData });
      await task.save();
      return task.toObject();
    } catch (err) {
      console.error("[DB] Error saving task:", err);
      throw err;
    }
  },
  updateTask: async (taskId, updateData) => {
    try {
      const res = await Task.findOneAndUpdate(
        { id: Number(taskId) },
        { $set: updateData },
        { new: true }
      ).lean();
      return res;
    } catch (err) {
      console.error("[DB] Error updating task:", err);
      throw err;
    }
  },
  deleteTask: async (taskId) => {
    try {
      await Task.deleteOne({ id: Number(taskId) });
      return true;
    } catch (err) {
      console.error("[DB] Error deleting task:", err);
      throw err;
    }
  },
  cleanExpiredMessages: async (io) => {
    try {
      const now = Date.now();

      // 1. Direct Messages
      const directMsgs = await Message.find({ self_destruct_seconds: { $gt: 0 } }).lean();
      for (const m of directMsgs) {
        const expiry = new Date(m.created_at).getTime() + m.self_destruct_seconds * 1000;
        if (expiry < now) {
          await Message.deleteOne({ id: m.id });
          console.log(`[SelfDestruct] Direct message ${m.id} deleted (expired).`);
          if (io) {
            io.to(`user_${m.receiver_id}`).emit("message_deleted", { messageId: String(m.id), chatId: m.sender_id, isGroup: false });
            io.to(`user_${m.sender_id}`).emit("message_deleted", { messageId: String(m.id), chatId: m.receiver_id, isGroup: false });
          }
        }
      }

      // 2. Group Messages
      const groupMsgs = await GroupMessage.find({ self_destruct_seconds: { $gt: 0 } }).lean();
      for (const m of groupMsgs) {
        const expiry = new Date(m.created_at).getTime() + m.self_destruct_seconds * 1000;
        if (expiry < now) {
          await GroupMessage.deleteOne({ id: m.id });
          console.log(`[SelfDestruct] Group message ${m.id} deleted (expired).`);
          if (io) {
            io.to(`group_${m.group_id}`).emit("message_deleted", { messageId: String(m.id), chatId: m.group_id, isGroup: true });
          }
        }
      }
    } catch (err) {
      console.error("[SelfDestruct] Error cleaning expired messages:", err);
    }
  }
};

module.exports = db;
