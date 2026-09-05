import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cloudClient = null;
let localDb = null;

const isTursoConfigured = Boolean(process.env.TURSO_DATABASE_URL);

if (isTursoConfigured) {
  console.log('Connecting to Turso Cloud SQLite Database...');
  cloudClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || ''
  });
} else {
  console.log('Connecting to Local SQLite Database fallback...');
  const dbPath = path.join(__dirname, 'pairly.db');
  localDb = new Database(dbPath);
  localDb.pragma('journal_mode = WAL');
}

export async function queryGet(sql, params = []) {
  if (cloudClient) {
    const res = await cloudClient.execute({ sql, args: params });
    if (res.rows && res.rows.length > 0) {
      return res.rows[0];
    }
    return null;
  } else {
    return localDb.prepare(sql).get(...params) || null;
  }
}

export async function queryAll(sql, params = []) {
  if (cloudClient) {
    const res = await cloudClient.execute({ sql, args: params });
    return res.rows || [];
  } else {
    return localDb.prepare(sql).all(...params) || [];
  }
}

export async function queryRun(sql, params = []) {
  if (cloudClient) {
    const res = await cloudClient.execute({ sql, args: params });
    return { changes: Number(res.rowsAffected) };
  } else {
    const info = localDb.prepare(sql).run(...params);
    return { changes: info.changes };
  }
}

export async function initDb() {
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(user2_id) REFERENCES users(id) ON DELETE CASCADE
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, emoji),
      FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS pinned_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      pinned_by TEXT NOT NULL,
      pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(conversation_id, message_id),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(shared_by) REFERENCES users(id) ON DELETE CASCADE
    );`
  ];

  for (const q of schemaQueries) {
    await queryRun(q);
  }

  console.log('Pairly Database initialized (Turso/Local compatible).');
}

export default {
  queryGet,
  queryAll,
  queryRun,
  initDb
};
