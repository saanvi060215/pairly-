import { createClient } from '@libsql/client/http';
import path from 'path';

const isTursoConfigured = Boolean(process.env.TURSO_DATABASE_URL);
let cloudClient = null;
let memoryStore = {
  users: new Map(),
  conversations: new Map(),
  messages: [],
  reactions: [],
  pinned: [],
  links: []
};

if (isTursoConfigured) {
  try {
    cloudClient = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN || ''
    });
  } catch (e) {
    console.error('Turso HTTP client init error:', e);
  }
}

export async function queryGet(sql, params = []) {
  if (cloudClient) {
    try {
      const res = await cloudClient.execute({ sql, args: params });
      if (res.rows && res.rows.length > 0) return res.rows[0];
      return null;
    } catch (err) {
      console.error('Turso queryGet error:', err);
      return null;
    }
  }

  // Memory Fallback for cold serverless functions without Turso env vars
  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes('from users where user_token =')) {
    for (const u of memoryStore.users.values()) {
      if (u.user_token === params[0]) return u;
    }
    return null;
  }
  if (lowerSql.includes('from users where id =')) {
    return memoryStore.users.get(params[0]) || null;
  }
  if (lowerSql.includes('from conversations where token_a =') || lowerSql.includes('from conversations where id =')) {
    const p = params[0];
    for (const c of memoryStore.conversations.values()) {
      if (c.token_a === p || c.token_b === p || c.id === p) return c;
    }
    return null;
  }

  return null;
}

export async function queryAll(sql, params = []) {
  if (cloudClient) {
    try {
      const res = await cloudClient.execute({ sql, args: params });
      return res.rows || [];
    } catch (err) {
      console.error('Turso queryAll error:', err);
      return [];
    }
  }

  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes('from messages')) {
    return memoryStore.messages.filter(m => m.conversation_id === params[0]);
  }
  if (lowerSql.includes('from shared_links')) {
    return memoryStore.links.filter(l => l.conversation_id === params[0]);
  }
  if (lowerSql.includes('from pinned_messages')) {
    return memoryStore.pinned.filter(p => p.conversation_id === params[0]);
  }

  return [];
}

export async function queryRun(sql, params = []) {
  if (cloudClient) {
    try {
      const res = await cloudClient.execute({ sql, args: params });
      return { changes: Number(res.rowsAffected) };
    } catch (err) {
      console.error('Turso queryRun error:', err);
      return { changes: 0 };
    }
  }

  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes('insert into users')) {
    const user = { id: params[0], name: params[1], avatar: params[2], user_token: params[3], is_online: params[4] || 1 };
    memoryStore.users.set(user.id, user);
    return { changes: 1 };
  }
  if (lowerSql.includes('update users set name =')) {
    const u = memoryStore.users.get(params[2]);
    if (u) {
      u.name = params[0];
      u.avatar = params[1];
    }
    return { changes: 1 };
  }
  if (lowerSql.includes('insert into conversations')) {
    const conv = { id: params[0], token_a: params[1], token_b: params[2], user1_id: params[3], user2_id: null };
    memoryStore.conversations.set(conv.id, conv);
    return { changes: 1 };
  }
  if (lowerSql.includes('update conversations set user2_id =')) {
    const c = memoryStore.conversations.get(params[1]);
    if (c) c.user2_id = params[0];
    return { changes: 1 };
  }

  return { changes: 1 };
}

export async function initDb() {
  if (cloudClient) {
    const schemaQueries = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT NOT NULL,
        user_token TEXT UNIQUE NOT NULL,
        is_online INTEGER DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        socket_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        token_a TEXT UNIQUE NOT NULL,
        token_b TEXT UNIQUE NOT NULL,
        user1_id TEXT NOT NULL,
        user2_id TEXT,
        active_link_url TEXT,
        active_link_title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        content TEXT NOT NULL,
        metadata TEXT,
        reply_to_id TEXT,
        is_edited INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 0,
        read_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS pinned_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        pinned_by TEXT NOT NULL,
        pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS shared_links (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        description TEXT,
        image TEXT,
        domain TEXT,
        shared_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`
    ];

    for (const q of schemaQueries) {
      try {
        await cloudClient.execute(q);
      } catch (e) {}
    }
  }

  console.log('Pairly Database initialized (Turso HTTP Client / Serverless Memory fallback).');
}

export default {
  queryGet,
  queryAll,
  queryRun,
  initDb
};
