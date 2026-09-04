import express from 'express';
import crypto from 'crypto';
import os from 'os';
import db from '../db.js';
import { authorizeConversationAccess } from '../middleware/auth.js';

const router = express.Router();

function generateId() {
  return crypto.randomUUID();
}

function generateSecureToken() {
  return crypto.randomBytes(5).toString('hex'); // 10 hex characters e.g. '7Kx92LmQ'
}

export function getPrimaryLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// System endpoint to return dynamic LAN IP
router.get('/system/lan-info', (req, res) => {
  const lanIp = getPrimaryLanIp();
  const port = process.env.PORT || 5000;
  return res.json({
    lanIp,
    port,
    lanBaseUrl: `http://${lanIp}:${port}`
  });
});

// 1. Setup Profile & Create Permanent Conversation (Dual Token Generation)
router.post('/setup', (req, res) => {
  const { name, avatar, userToken: existingToken } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Display name is required' });
  }

  let user;
  let userToken;

  if (existingToken) {
    user = db.prepare('SELECT * FROM users WHERE user_token = ?').get(existingToken);
    if (user) {
      db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?').run(name.trim(), avatar || 'avatar-1', user.id);
      userToken = existingToken;
    }
  }

  if (!user) {
    const userId = generateId();
    userToken = crypto.randomBytes(16).toString('hex');
    db.prepare(`
      INSERT INTO users (id, name, avatar, user_token, is_online)
      VALUES (?, ?, ?, ?, 1)
    `).run(userId, name.trim(), avatar || 'avatar-1', userToken);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }

  // Generate two unique permanent tokens for Participant A and Participant B
  const conversationId = generateId();
  const tokenA = generateSecureToken();
  const tokenB = generateSecureToken();

  db.prepare(`
    INSERT INTO conversations (id, token_a, token_b, user1_id)
    VALUES (?, ?, ?, ?)
  `).run(conversationId, tokenA, tokenB, user.id);

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  const lanIp = getPrimaryLanIp();
  const port = process.env.PORT || 5000;

  return res.json({
    conversation,
    user: { id: user.id, name: user.name, avatar: user.avatar },
    userToken,
    myToken: tokenA,
    partnerToken: tokenB,
    myUrl: `/p/${tokenA}`,
    partnerUrl: `/p/${tokenB}`,
    lanShareUrl: `http://${lanIp}:${port}/p/${tokenB}`
  });
});

// 2. Resolve Conversation Details by Token (/p/:token)
router.get('/p/:token', (req, res) => {
  const { token } = req.params;
  const conversation = db.prepare(
    'SELECT * FROM conversations WHERE token_a = ? OR token_b = ? OR id = ?'
  ).get(token, token, token);

  if (!conversation) {
    return res.status(404).json({ error: 'Private space not found. Please check your link.' });
  }

  const user1 = db.prepare('SELECT id, name, avatar, is_online, last_seen FROM users WHERE id = ?').get(conversation.user1_id);
  const user2 = conversation.user2_id ? db.prepare('SELECT id, name, avatar, is_online, last_seen FROM users WHERE id = ?').get(conversation.user2_id) : null;
  const lanIp = getPrimaryLanIp();
  const port = process.env.PORT || 5000;

  // Determine partner token to share
  const shareToken = (token === conversation.token_a) ? conversation.token_b : conversation.token_a;

  return res.json({
    conversation,
    user1,
    user2,
    participantCount: user2 ? 2 : 1,
    shareToken,
    lanShareUrl: `http://${lanIp}:${port}/p/${shareToken}`
  });
});

// 3. Join Conversation via Token
router.post('/p/:token/join', (req, res) => {
  const { token } = req.params;
  const { name, avatar, userToken: existingToken } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Display name is required' });
  }

  const conversation = db.prepare(
    'SELECT * FROM conversations WHERE token_a = ? OR token_b = ? OR id = ?'
  ).get(token, token, token);

  if (!conversation) {
    return res.status(404).json({ error: 'Private space not found' });
  }

  let user;
  let userToken;

  if (existingToken) {
    user = db.prepare('SELECT * FROM users WHERE user_token = ?').get(existingToken);
  }

  if (!user) {
    const userId = generateId();
    userToken = crypto.randomBytes(16).toString('hex');
    db.prepare(`
      INSERT INTO users (id, name, avatar, user_token, is_online)
      VALUES (?, ?, ?, ?, 1)
    `).run(userId, name.trim(), avatar || 'avatar-2', userToken);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  } else {
    userToken = existingToken;
    db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?').run(name.trim(), avatar || user.avatar, user.id);
  }

  // Link User 2 if slot open
  if (conversation.user1_id !== user.id && conversation.user2_id !== user.id) {
    if (conversation.user2_id !== null) {
      return res.status(403).json({ error: 'This private conversation is limited to 2 participants.' });
    }

    db.prepare('UPDATE conversations SET user2_id = ? WHERE id = ?').run(user.id, conversation.id);
  }

  const updatedConversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversation.id);
  const lanIp = getPrimaryLanIp();
  const port = process.env.PORT || 5000;
  const shareToken = (token === updatedConversation.token_a) ? updatedConversation.token_b : updatedConversation.token_a;

  return res.json({
    conversation: updatedConversation,
    user: { id: user.id, name: user.name, avatar: user.avatar },
    userToken,
    shareToken,
    lanShareUrl: `http://${lanIp}:${port}/p/${shareToken}`
  });
});

// 4. Clear Chat History
router.post('/p/:token/clear', authorizeConversationAccess, (req, res) => {
  const conversation = req.conversation;

  db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversation.id);
    db.prepare('DELETE FROM shared_links WHERE conversation_id = ?').run(conversation.id);
    db.prepare('DELETE FROM pinned_messages WHERE conversation_id = ?').run(conversation.id);
    db.prepare("UPDATE conversations SET active_link_url = NULL, active_link_title = NULL WHERE id = ?").run(conversation.id);
  })();

  return res.json({ success: true, message: 'Chat history cleared successfully' });
});

// 5. Get Messages (Authorized)
router.get('/p/:token/messages', authorizeConversationAccess, (req, res) => {
  const conversation = req.conversation;
  const currentUser = req.user;

  const partnerId = conversation.user1_id === currentUser.id ? conversation.user2_id : conversation.user1_id;
  const partner = partnerId ? db.prepare('SELECT id, name, avatar, is_online, last_seen FROM users WHERE id = ?').get(partnerId) : null;

  const messages = db.prepare(`
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(conversation.id).map(msg => {
    let metadata = null;
    try {
      if (msg.metadata) metadata = JSON.parse(msg.metadata);
    } catch (e) {}

    const reactions = db.prepare(`
      SELECT r.emoji, r.user_id, u.name as user_name
      FROM reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.message_id = ?
    `).all(msg.id);

    const isPinned = !!db.prepare(`
      SELECT id FROM pinned_messages WHERE conversation_id = ? AND message_id = ?
    `).get(conversation.id, msg.id);

    return {
      ...msg,
      metadata,
      reactions,
      isPinned
    };
  });

  return res.json({
    conversation,
    partner,
    messages
  });
});

// 6. Get Shared Content (Authorized)
router.get('/p/:token/shared-content', authorizeConversationAccess, (req, res) => {
  const conversation = req.conversation;

  const links = db.prepare(`
    SELECT sl.*, u.name as shared_by_name
    FROM shared_links sl
    JOIN users u ON sl.shared_by = u.id
    WHERE sl.conversation_id = ?
    ORDER BY sl.created_at DESC
  `).all(conversation.id);

  const pinned = db.prepare(`
    SELECT pm.id as pin_id, pm.pinned_at, m.*, u.name as sender_name, u.avatar as sender_avatar
    FROM pinned_messages pm
    JOIN messages m ON pm.message_id = m.id
    JOIN users u ON m.sender_id = u.id
    WHERE pm.conversation_id = ?
    ORDER BY pm.pinned_at DESC
  `).all(conversation.id).map(msg => {
    let metadata = null;
    try {
      if (msg.metadata) metadata = JSON.parse(msg.metadata);
    } catch (e) {}
    return { ...msg, metadata };
  });

  const mediaMessages = db.prepare(`
    SELECT m.*, u.name as sender_name
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ? AND (m.type = 'image' OR m.type = 'file') AND m.is_deleted = 0
    ORDER BY m.created_at DESC
  `).all(conversation.id).map(msg => {
    let metadata = null;
    try {
      if (msg.metadata) metadata = JSON.parse(msg.metadata);
    } catch (e) {}
    return { ...msg, metadata };
  });

  return res.json({ links, pinned, media: mediaMessages });
});

// 7. Search Messages (Authorized)
router.get('/p/:token/search', authorizeConversationAccess, (req, res) => {
  const conversation = req.conversation;
  const { q } = req.query;

  if (!q || !q.trim()) return res.json({ results: [] });

  const searchTerm = `%${q.trim()}%`;
  const results = db.prepare(`
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ? AND m.content LIKE ? AND m.is_deleted = 0
    ORDER BY m.created_at DESC
    LIMIT 30
  `).all(conversation.id, searchTerm).map(msg => {
    let metadata = null;
    try {
      if (msg.metadata) metadata = JSON.parse(msg.metadata);
    } catch (e) {}
    return { ...msg, metadata };
  });

  return res.json({ results });
});

export default router;
