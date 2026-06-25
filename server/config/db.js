/**
 * db.js — JSON file store (zero-dependency, no server required).
 * Drop-in replacement: exposes db.query(sql, params) → [[rows], fields]
 * Data is persisted to server/data/db.json automatically.
 *
 * To switch to MongoDB later, set MONGODB_URI in .env and replace this file
 * with the mongoose version.
 */
"use strict";
const fs   = require("fs");
const path = require("path");

const DATA_DIR  = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

// ── Store ─────────────────────────────────────────────────────────────────────
const fresh = () => ({
  counters: { users:0, messages:0, groups:0, group_messages:0, call_logs:0, otps:0 },
  users:[], messages:[], groups_table:[], group_members:[],
  group_messages:[], call_logs:[], call_participants:[],
  password_reset_otps:[], blocked_users:[],
});

let store;
(() => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    store = fs.existsSync(DATA_FILE)
      ? { ...fresh(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) }
      : fresh();
    console.log("[DB] JSON file store ready →", DATA_FILE);
  } catch (e) { console.error("[DB] Load error:", e.message); store = fresh(); }
})();

let _t = null;
const save = () => {
  if (_t) clearTimeout(_t);
  _t = setTimeout(() => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2)); }
    catch (e) { console.error("[DB] Save error:", e.message); }
  }, 300);
};

const nextId = (col) => { store.counters[col] = (store.counters[col]||0)+1; return store.counters[col]; };
const now    = () => new Date().toISOString();
const N      = (v)  => Number(v);
const pick   = (o, ks) => Object.fromEntries(ks.map(k=>[k, o[k]]));
const getUser= (id) => store.users.find(u => u.id === N(id)) || null;

// ── Complex helpers ────────────────────────────────────────────────────────────
function activeContacts(userId) {
  const uid = N(userId);
  const seen = new Map();
  for (const m of store.messages) {
    const other = m.sender_id===uid ? m.receiver_id : m.receiver_id===uid ? m.sender_id : null;
    if (!other||other===uid) continue;
    const prev = seen.get(other);
    if (!prev||new Date(m.created_at)>new Date(prev)) seen.set(other, m.created_at);
  }
  for (const cl of store.call_logs) {
    if (cl.group_id) continue;
    const other = cl.caller_id===uid ? cl.receiver_id : cl.receiver_id===uid ? cl.caller_id : null;
    if (!other||other===uid) continue;
    const ts = cl.ended_at||cl.created_at;
    const prev = seen.get(other);
    if (!prev||new Date(ts)>new Date(prev)) seen.set(other, ts);
  }
  return [...seen.entries()].map(([otherId, lastTs]) => {
    const u = getUser(otherId); if(!u) return null;
    const unread = store.messages.filter(m=>m.sender_id===otherId&&m.receiver_id===uid&&!m.is_read).length;
    return { id:u.id, username:u.username, avatar:u.avatar, bio:u.bio,
             is_online:u.is_online||0, last_seen:u.last_seen,
             unread_count:unread, last_interaction:lastTs };
  }).filter(Boolean).sort((a,b)=>new Date(b.last_interaction)-new Date(a.last_interaction));
}

function messageHistory(uid, cid) {
  const u=N(uid), c=N(cid);
  const msgs = store.messages
    .filter(m=>(m.sender_id===u&&m.receiver_id===c)||(m.sender_id===c&&m.receiver_id===u))
    .map(m=>{ const s=getUser(m.sender_id)||{}; return { ...m, sender_name:s.username, sender_avatar:s.avatar, call_type:null, status:null, duration_seconds:0, is_call_event:0 }; });
  const calls = store.call_logs
    .filter(cl=>!cl.group_id&&((cl.caller_id===u&&cl.receiver_id===c)||(cl.caller_id===c&&cl.receiver_id===u)))
    .map(cl=>{ const s=getUser(cl.caller_id)||{}; return { id:`call_${cl.id}`, sender_id:cl.caller_id, receiver_id:cl.receiver_id, message:"", is_read:1, created_at:cl.ended_at||cl.created_at, sender_name:s.username, sender_avatar:s.avatar, call_type:cl.call_type, status:cl.status, duration_seconds:cl.duration_seconds||0, is_call_event:1 }; });
  return [...msgs,...calls].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
}

function callLogWithUsers(id) {
  const cl = store.call_logs.find(l=>l.id===N(id)); if(!cl) return [];
  const u1=getUser(cl.caller_id)||{}, u2=cl.receiver_id?(getUser(cl.receiver_id)||{}):null;
  const g=cl.group_id?store.groups_table.find(g=>g.id===cl.group_id):null;
  return [{ ...cl, caller_name:u1.username, caller_avatar:u1.avatar, receiver_name:u2?.username, receiver_avatar:u2?.avatar, group_name:g?.name, group_avatar:g?.avatar }];
}

function callHistory(userId) {
  const uid=N(userId);
  const myGroups = store.group_members.filter(m=>m.user_id===uid).map(m=>m.group_id);
  return store.call_logs
    .filter(cl=>(!cl.group_id&&(cl.caller_id===uid||cl.receiver_id===uid))||(cl.group_id&&myGroups.includes(cl.group_id)))
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,100)
    .map(cl=>{ const u1=getUser(cl.caller_id)||{}, u2=cl.receiver_id?(getUser(cl.receiver_id)||{}):null; const g=cl.group_id?store.groups_table.find(g=>g.id===cl.group_id):null; return { ...cl, caller_name:u1.username, caller_avatar:u1.avatar, receiver_name:u2?.username, receiver_avatar:u2?.avatar, group_name:g?.name, group_avatar:g?.avatar }; });
}

// ── SELECT ─────────────────────────────────────────────────────────────────────
function handleSelect(sl, p) {
  const R = rows => [rows];

  if (sl.includes("unread_count")&&sl.includes("last_interaction")) return R(activeContacts(p[0]));
  if (sl.includes("union all")&&sl.includes("is_call_event"))       return R(messageHistory(p[0],p[1]));
  if (sl.includes("group_name")&&sl.includes("limit 100"))          return R(callHistory(p[0]));
  if (sl.includes("caller_name")&&sl.includes("from call_logs"))    return R(callLogWithUsers(p[0]));

  if (sl.includes("select group_id from call_logs")) {
    const cl=store.call_logs.find(l=>l.id===N(p[0]));
    return R(cl?[{group_id:cl.group_id}]:[]);
  }
  if (sl.includes("from call_participants")&&sl.includes("join users")) {
    const ids=p.map(Number);
    return R(store.call_participants.filter(cp=>ids.includes(cp.call_log_id))
      .map(cp=>{ const u=getUser(cp.user_id); return u?{call_log_id:cp.call_log_id,id:u.id,username:u.username,avatar:u.avatar}:null; }).filter(Boolean));
  }

  // users
  if (/select \* from users where email/.test(sl))                      return R(store.users.filter(u=>u.email===p[0]));
  if (/select id, username from users where email/.test(sl))            return R(store.users.filter(u=>u.email===p[0]).map(u=>({id:u.id,username:u.username})));
  if (/select id from users where email/.test(sl))                      return R(store.users.filter(u=>u.email===p[0]).map(u=>({id:u.id})));
  if (/select id from users where username/.test(sl)&&sl.includes("and id !=")) return R(store.users.filter(u=>u.username===p[0]&&u.id!==N(p[1])).map(u=>({id:u.id})));
  if (/select id from users where username/.test(sl))                   return R(store.users.filter(u=>u.username===p[0]).map(u=>({id:u.id})));
  if (/select password from users/.test(sl))                            return R(store.users.filter(u=>u.id===N(p[0])).map(u=>({password:u.password})));
  if (/select id, username, avatar from users where username/.test(sl)) return R(store.users.filter(u=>u.username===p[0]).map(u=>({id:u.id,username:u.username,avatar:u.avatar})));
  if (sl.includes("from users where id in")) {
    const ids=p.flat().map(Number);
    return R(store.users.filter(u=>ids.includes(u.id)).map(u=>({id:u.id,username:u.username,avatar:u.avatar})));
  }
  if (sl.includes("like")&&sl.includes("from users")) {
    const term=p[0].replace(/%/g,"").toLowerCase(), excl=N(p[1]);
    return R(store.users.filter(u=>u.username.toLowerCase().includes(term)&&u.id!==excl)
      .map(u=>pick(u,["id","username","avatar","bio","is_online","last_seen"])));
  }
  if (sl.includes("created_at from users where id"))
    return R(store.users.filter(u=>u.id===N(p[0])).map(u=>pick(u,["id","username","email","avatar","bio","created_at"])));
  if (sl.includes("last_seen from users where id"))
    return R(store.users.filter(u=>u.id===N(p[0])).map(u=>pick(u,["id","username","email","avatar","bio","is_online","last_seen"])));

  // messages
  if (sl.includes("count(*) as total from messages"))
    return R([{total:store.messages.filter(m=>m.receiver_id===N(p[0])&&!m.is_read).length}]);

  // blocked
  if (sl.includes("select blocked_id from blocked_users"))
    return R(store.blocked_users.filter(b=>b.blocker_id===N(p[0])).map(b=>({blocked_id:b.blocked_id})));
  if (sl.includes("from blocked_users"))
    return R(store.blocked_users.filter(b=>(b.blocker_id===N(p[0])&&b.blocked_id===N(p[1]))||(b.blocker_id===N(p[2])&&b.blocked_id===N(p[3]))));

  // groups
  if (sl.includes("from groups_table g")&&sl.includes("join group_members")) {
    const gids=store.group_members.filter(m=>m.user_id===N(p[0])).map(m=>m.group_id);
    return R(store.groups_table.filter(g=>gids.includes(g.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
  }
  if (/select \* from groups_table where id/.test(sl)) return R(store.groups_table.filter(g=>g.id===N(p[0])));
  if (sl.includes("from group_messages")&&sl.includes("join users"))
    return R(store.group_messages.filter(m=>m.group_id===N(p[0]))
      .map(m=>{ const u=getUser(m.sender_id)||{}; return {...m,sender_name:u.username,sender_avatar:u.avatar}; })
      .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)));
  if (sl.includes("select user_id from group_members where group_id"))
    return R(store.group_members.filter(m=>m.group_id===N(p[0])).map(m=>({user_id:m.user_id})));
  if (sl.includes("from group_members gm")&&sl.includes("join users")) {
    return R(store.group_members.filter(m=>m.group_id===N(p[0])).map(m=>getUser(m.user_id)).filter(Boolean)
      .map(u=>pick(u,["id","username","avatar","bio","is_online","last_seen"])));
  }
  if (/select \* from group_members where group_id/.test(sl)&&sl.includes("and user_id"))
    return R(store.group_members.filter(m=>m.group_id===N(p[0])&&m.user_id===N(p[1])));

  // OTPs
  if (sl.includes("from password_reset_otps")&&sl.includes("limit 1")) {
    const rec=store.password_reset_otps.filter(r=>r.email===p[0]&&!r.used).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
    return R(rec?[rec]:[]);
  }
  if (sl.includes("from password_reset_otps")&&sl.includes("and user_id"))
    return R(store.password_reset_otps.filter(r=>r.id===N(p[0])&&r.user_id===N(p[1])&&!r.used));

  throw new Error(`[DB] Unhandled SELECT: ${sl.substring(0,120)}`);
}

// ── INSERT ─────────────────────────────────────────────────────────────────────
function handleInsert(sl, p) {
  const ig = sl.includes("insert ignore");

  if (sl.includes("into users")) {
    const id=nextId("users");
    store.users.push({id,username:p[0],email:p[1],password:p[2],avatar:p[3],bio:"Hey there! I am using PingMe.",is_online:0,last_seen:now(),created_at:now()});
    save(); return [{insertId:id,affectedRows:1}];
  }
  if (sl.includes("into messages")) {
    const id=nextId("messages");
    store.messages.push({id,sender_id:N(p[0]),receiver_id:N(p[1]),message:p[2],is_read:false,created_at:now()});
    save(); return [{insertId:id,affectedRows:1}];
  }
  if (sl.includes("into group_messages")) {
    const id=nextId("group_messages");
    store.group_messages.push({id,group_id:N(p[0]),sender_id:N(p[1]),message:p[2],created_at:now()});
    save(); return [{insertId:id,affectedRows:1}];
  }
  if (sl.includes("into groups_table")) {
    const id=nextId("groups");
    store.groups_table.push({id,name:p[0],created_by:N(p[1]),avatar:p[2],created_at:now()});
    save(); return [{insertId:id,affectedRows:1}];
  }
  if (sl.includes("into group_members")) {
    const [gid,uid]=[N(p[0]),N(p[1])];
    if(ig&&store.group_members.find(m=>m.group_id===gid&&m.user_id===uid)) return [{affectedRows:0}];
    store.group_members.push({group_id:gid,user_id:uid,joined_at:now()});
    save(); return [{affectedRows:1}];
  }
  if (sl.includes("into call_logs")) {
    const id=nextId("call_logs");
    const entry = sl.includes("group_id")
      ? {id,caller_id:N(p[0]),group_id:N(p[1]),call_type:p[2],status:"calling",duration_seconds:0,created_at:now(),ended_at:null,receiver_id:null}
      : {id,caller_id:N(p[0]),receiver_id:N(p[1]),call_type:p[2],status:"calling",duration_seconds:0,created_at:now(),ended_at:null,group_id:null};
    store.call_logs.push(entry); save(); return [{insertId:id,affectedRows:1}];
  }
  if (sl.includes("into call_participants")) {
    const [cid,uid]=[N(p[0]),N(p[1])];
    if(ig&&store.call_participants.find(c=>c.call_log_id===cid&&c.user_id===uid)) return [{affectedRows:0}];
    store.call_participants.push({call_log_id:cid,user_id:uid,joined_at:now()});
    save(); return [{affectedRows:1}];
  }
  if (sl.includes("into password_reset_otps")) {
    const id=nextId("otps");
    store.password_reset_otps.push({id,user_id:N(p[0]),email:p[1],otp_hash:p[2],expires_at:new Date(p[3]).toISOString(),attempts:0,used:false,created_at:now()});
    save(); return [{insertId:id,affectedRows:1}];
  }
  if (sl.includes("into blocked_users")) {
    const [bid,blkid]=[N(p[0]),N(p[1])];
    if(ig&&store.blocked_users.find(b=>b.blocker_id===bid&&b.blocked_id===blkid)) return [{affectedRows:0}];
    store.blocked_users.push({blocker_id:bid,blocked_id:blkid,created_at:now()});
    save(); return [{affectedRows:1}];
  }
  throw new Error(`[DB] Unhandled INSERT: ${sl.substring(0,100)}`);
}

// ── UPDATE ─────────────────────────────────────────────────────────────────────
function handleUpdate(sl, p) {
  let r;
  if (sl.includes("update users set is_online = 0")&&!sl.includes("where")) { store.users.forEach(u=>{u.is_online=0;}); save(); return [{affectedRows:store.users.length}]; }
  if (sl.includes("update users set is_online = 1")) { const u=getUser(p[0]); if(u)u.is_online=1; save(); return [{affectedRows:u?1:0}]; }
  if (sl.includes("update users set is_online = 0, last_seen")) { const u=getUser(p[0]); if(u){u.is_online=0;u.last_seen=now();} save(); return [{affectedRows:u?1:0}]; }
  if (sl.includes("update users set username")&&sl.includes("bio")&&sl.includes("avatar")) { const u=getUser(p[3]); if(u){u.username=p[0];u.bio=p[1];u.avatar=p[2];} save(); return [{affectedRows:u?1:0}]; }
  if (sl.includes("update users set password")&&sl.includes("where id")) { const u=getUser(p[1]); if(u)u.password=p[0]; save(); return [{affectedRows:u?1:0}]; }

  if (sl.includes("update messages set is_read = 1 where id")) { const m=store.messages.find(m=>m.id===N(p[0])); if(m)m.is_read=true; save(); return [{affectedRows:m?1:0}]; }
  if (sl.includes("update messages set is_read = 1 where sender_id")) {
    let cnt=0; store.messages.filter(m=>m.sender_id===N(p[0])&&m.receiver_id===N(p[1])&&!m.is_read).forEach(m=>{m.is_read=true;cnt++;});
    save(); return [{affectedRows:cnt}];
  }

  if (sl.includes("update password_reset_otps set used = true where user_id")) {
    let cnt=0; store.password_reset_otps.filter(r=>r.user_id===N(p[0])&&!r.used).forEach(r=>{r.used=true;cnt++;});
    save(); return [{affectedRows:cnt}];
  }
  if (sl.includes("update password_reset_otps set used = true where id")) { const r=store.password_reset_otps.find(r=>r.id===N(p[0])); if(r)r.used=true; save(); return [{affectedRows:r?1:0}]; }
  if (sl.includes("update password_reset_otps set attempts = attempts + 1")) { const r=store.password_reset_otps.find(r=>r.id===N(p[0])); if(r)r.attempts=(r.attempts||0)+1; save(); return [{affectedRows:r?1:0}]; }

  if (sl.includes("update call_logs")&&sl.includes("group_id")&&sl.includes("caller_id")&&sl.includes("'missed'")) {
    let cnt=0; store.call_logs.filter(l=>l.group_id===N(p[0])&&l.caller_id===N(p[1])&&l.status==="calling").forEach(l=>{l.status="missed";l.ended_at=now();cnt++;});
    save(); return [{affectedRows:cnt}];
  }
  if (sl.includes("update call_logs")&&sl.includes("'accepted'")&&sl.includes("and status = 'calling'")) { const l=store.call_logs.find(l=>l.id===N(p[0])&&l.status==="calling"); if(l){l.status="accepted";l.ended_at=now();} save(); return [{affectedRows:l?1:0}]; }
  if (sl.includes("set status='missed'")) { const l=store.call_logs.find(l=>l.id===N(p[0])); if(l){l.status="missed";l.ended_at=now();} save(); return [{affectedRows:l?1:0}]; }
  if (sl.includes("set status='declined'")) { const l=store.call_logs.find(l=>l.id===N(p[0])); if(l){l.status="declined";l.ended_at=now();} save(); return [{affectedRows:l?1:0}]; }
  if (sl.includes("set status='accepted'")) { const l=store.call_logs.find(l=>l.id===N(p[0])); if(l)l.status="accepted"; save(); return [{affectedRows:l?1:0}]; }
  if (sl.includes("set status = ?, duration_seconds")) { const l=store.call_logs.find(l=>l.id===N(p[2])); if(l){l.status=p[0];l.duration_seconds=N(p[1]);l.ended_at=now();} save(); return [{affectedRows:l?1:0}]; }
  if (sl.includes("set status = 'accepted', duration_seconds")) { const l=store.call_logs.find(l=>l.id===N(p[1])); if(l){l.status="accepted";l.duration_seconds=N(p[0]);l.ended_at=now();} save(); return [{affectedRows:l?1:0}]; }

  throw new Error(`[DB] Unhandled UPDATE: ${sl.substring(0,120)}`);
}

// ── DELETE ─────────────────────────────────────────────────────────────────────
function handleDelete(sl, p) {
  let before;
  if (sl.includes("from messages")) {
    before=store.messages.length; const u=N(p[0]),c=N(p[1]);
    store.messages=store.messages.filter(m=>!((m.sender_id===u&&m.receiver_id===c)||(m.sender_id===c&&m.receiver_id===u)));
    save(); return [{affectedRows:before-store.messages.length}];
  }
  if (sl.includes("from call_logs")) {
    before=store.call_logs.length; const u=N(p[0]),c=N(p[1]);
    store.call_logs=store.call_logs.filter(l=>!((l.caller_id===u&&l.receiver_id===c)||(l.caller_id===c&&l.receiver_id===u)));
    save(); return [{affectedRows:before-store.call_logs.length}];
  }
  if (sl.includes("from blocked_users")) {
    before=store.blocked_users.length;
    store.blocked_users=store.blocked_users.filter(b=>!(b.blocker_id===N(p[0])&&b.blocked_id===N(p[1])));
    save(); return [{affectedRows:before-store.blocked_users.length}];
  }
  throw new Error(`[DB] Unhandled DELETE: ${sl.substring(0,100)}`);
}

// ── Entry point ────────────────────────────────────────────────────────────────
const db = {
  query: async (sql, params=[]) => {
    const sl = sql.replace(/\s+/g," ").trim().toLowerCase();
    if (sl.startsWith("create table")||sl.startsWith("alter table")) return [{affectedRows:0}];
    if (sl.startsWith("show columns")) return [[{Field:"is_read"}]];
    if (sl.startsWith("select")) return handleSelect(sl, params);
    if (sl.startsWith("insert")) return handleInsert(sl, params);
    if (sl.startsWith("update")) return handleUpdate(sl, params);
    if (sl.startsWith("delete")) return handleDelete(sl, params);
    throw new Error(`[DB] Unsupported: ${sl.substring(0,80)}`);
  }
};

module.exports = db;
