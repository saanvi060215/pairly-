import { createClient } from '@libsql/client/http';
import { getStore } from '@netlify/blobs';

const isTursoConfigured = Boolean(process.env.TURSO_DATABASE_URL);
let cloudClient = null;

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

let memoryStore = {
  users: new Map(),
  conversations: new Map(),
  messages: [],
  reactions: [],
  pinned: [],
  links: []
};

let blobStore = null;
try {
  blobStore = getStore('pairly_db');
} catch (e) {
  console.log('Netlify Blobs init note:', e.message);
}

async function loadMemoryFromBlobs() {
  if (cloudClient || !blobStore) return;
  try {
    const data = await blobStore.get('pairly_state', { type: 'json' });
    if (data) {
      if (Array.isArray(data.users)) memoryStore.users = new Map(data.users);
      if (Array.isArray(data.conversations)) memoryStore.conversations = new Map(data.conversations);
      if (Array.isArray(data.messages)) memoryStore.messages = data.messages;
      if (Array.isArray(data.reactions)) memoryStore.reactions = data.reactions;
      if (Array.isArray(data.pinned)) memoryStore.pinned = data.pinned;
      if (Array.isArray(data.links)) memoryStore.links = data.links;
    }
  } catch (err) {
    console.warn('Failed to load Netlify Blob state:', err.message);
  }
}

async function saveMemoryToBlobs() {
  if (cloudClient || !blobStore) return;
  try {
    const data = {
      users: Array.from(memoryStore.users.entries()),
      conversations: Array.from(memoryStore.conversations.entries()),
      messages: memoryStore.messages,
      reactions: memoryStore.reactions,
      pinned: memoryStore.pinned,
      links: memoryStore.links
    };
    await blobStore.setJSON('pairly_state', data);
  } catch (err) {
    console.warn('Failed to save Netlify Blob state:', err.message);
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

  await loadMemoryFromBlobs();

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
  if (lowerSql.includes('from messages') && lowerSql.includes('where m.id =')) {
    const msg = memoryStore.messages.find(m => m.id === params[0]);
    if (!msg) return null;
    const sender = memoryStore.users.get(msg.sender_id);
    return {
      ...msg,
      sender_name: sender ? sender.name : 'User',
      sender_avatar: sender ? sender.avatar : '🦊'
    };
  }
  if (lowerSql.includes('from messages') && lowerSql.includes('where id =')) {
    return memoryStore.messages.find(m => m.id === params[0]) || null;
  }
  if (lowerSql.includes('from pinned_messages')) {
    return memoryStore.pinned.find(p => p.conversation_id === params[0] && p.message_id === params[1]) || null;
  }
  if (lowerSql.includes('from reactions')) {
    return memoryStore.reactions.find(r => r.message_id === params[0] && r.user_id === params[1] && r.emoji === params[2]) || null;
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

  await loadMemoryFromBlobs();

  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes('from messages')) {
    const conversationId = params[0];
    const msgs = memoryStore.messages.filter(m => m.conversation_id === conversationId);
    return msgs.map(m => {
      const sender = memoryStore.users.get(m.sender_id);
      return {
        ...m,
        sender_name: sender ? sender.name : 'User',
        sender_avatar: sender ? sender.avatar : '🦊'
      };
    });
  }
  if (lowerSql.includes('from shared_links')) {
    const conversationId = params[0];
    const links = memoryStore.links.filter(l => l.conversation_id === conversationId);
    return links.map(l => {
      const u = memoryStore.users.get(l.shared_by);
      return { ...l, shared_by_name: u ? u.name : 'User' };
    });
  }
  if (lowerSql.includes('from pinned_messages')) {
    const conversationId = params[0];
    const pins = memoryStore.pinned.filter(p => p.conversation_id === conversationId);
    return pins.map(p => {
      const msg = memoryStore.messages.find(m => m.id === p.message_id) || {};
      const sender = memoryStore.users.get(msg.sender_id);
      return {
        pin_id: p.id,
        pinned_at: p.pinned_at,
        ...msg,
        sender_name: sender ? sender.name : 'User',
        sender_avatar: sender ? sender.avatar : '🦊'
      };
    });
  }
  if (lowerSql.includes('from reactions')) {
    const messageId = params[0];
    const rxns = memoryStore.reactions.filter(r => r.message_id === messageId);
    return rxns.map(r => {
      const u = memoryStore.users.get(r.user_id);
      return { ...r, user_name: u ? u.name : 'User' };
    });
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

  await loadMemoryFromBlobs();

  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes('insert into users')) {
    const user = { id: params[0], name: params[1], avatar: params[2], user_token: params[3], is_online: params[4] || 1 };
    memoryStore.users.set(user.id, user);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('update users set name =')) {
    const u = memoryStore.users.get(params[2]);
    if (u) {
      u.name = params[0];
      u.avatar = params[1];
      await saveMemoryToBlobs();
    }
    return { changes: 1 };
  }
  if (lowerSql.includes('update users set is_online =')) {
    const u = memoryStore.users.get(params[2]);
    if (u) {
      u.is_online = params[0];
      u.last_seen = params[1];
      await saveMemoryToBlobs();
    }
    return { changes: 1 };
  }
  if (lowerSql.includes('insert into conversations')) {
    const conv = { id: params[0], token_a: params[1], token_b: params[2], user1_id: params[3], user2_id: null };
    memoryStore.conversations.set(conv.id, conv);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('update conversations set user2_id =')) {
    const c = memoryStore.conversations.get(params[1]);
    if (c) {
      c.user2_id = params[0];
      await saveMemoryToBlobs();
    }
    return { changes: 1 };
  }
  if (lowerSql.includes('insert into messages')) {
    const msg = {
      id: params[0],
      conversation_id: params[1],
      sender_id: params[2],
      type: params[3],
      content: params[4],
      metadata: params[5],
      reply_to_id: params[6],
      created_at: params[7] || new Date().toISOString(),
      is_edited: 0,
      is_deleted: 0,
      is_read: 0
    };
    memoryStore.messages.push(msg);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('update messages set content =')) {
    const m = memoryStore.messages.find(x => x.id === params[1]);
    if (m) {
      m.content = params[0];
      m.is_edited = 1;
      await saveMemoryToBlobs();
    }
    return { changes: 1 };
  }
  if (lowerSql.includes('update messages set is_deleted =')) {
    const m = memoryStore.messages.find(x => x.id === params[0]);
    if (m) {
      m.is_deleted = 1;
      m.content = 'This message was deleted';
      await saveMemoryToBlobs();
    }
    return { changes: 1 };
  }
  if (lowerSql.includes('delete from messages')) {
    memoryStore.messages = memoryStore.messages.filter(m => m.conversation_id !== params[0]);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('insert into shared_links')) {
    const link = {
      id: params[0],
      conversation_id: params[1],
      url: params[2],
      title: params[3],
      description: params[4],
      image: params[5],
      domain: params[6],
      shared_by: params[7],
      created_at: new Date().toISOString()
    };
    memoryStore.links.push(link);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('delete from shared_links')) {
    memoryStore.links = memoryStore.links.filter(l => l.conversation_id !== params[0]);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('insert into pinned_messages')) {
    const pin = {
      id: params[0],
      conversation_id: params[1],
      message_id: params[2],
      pinned_by: params[3],
      pinned_at: new Date().toISOString()
    };
    memoryStore.pinned.push(pin);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('delete from pinned_messages where id =')) {
    memoryStore.pinned = memoryStore.pinned.filter(p => p.id !== params[0]);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('delete from pinned_messages where conversation_id =')) {
    memoryStore.pinned = memoryStore.pinned.filter(p => p.conversation_id !== params[0]);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('insert into reactions')) {
    const rxn = {
      id: params[0],
      message_id: params[1],
      user_id: params[2],
      emoji: params[3],
      created_at: new Date().toISOString()
    };
    memoryStore.reactions.push(rxn);
    await saveMemoryToBlobs();
    return { changes: 1 };
  }
  if (lowerSql.includes('delete from reactions where id =')) {
    memoryStore.reactions = memoryStore.reactions.filter(r => r.id !== params[0]);
    await saveMemoryToBlobs();
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
  } else {
    await loadMemoryFromBlobs();
  }

  console.log('Pairly Database initialized (Turso HTTP Client / Netlify Blobs persistent store).');
}

export default {
  queryGet,
  queryAll,
  queryRun,
  initDb
};
