import express from 'express';
import crypto from 'crypto';
import os from 'os';
import { queryGet, queryAll, queryRun } from '../db.js';
import { authorizeConversationAccess } from '../middleware/auth.js';
import { triggerEvent, authenticateChannel } from '../pusher.js';

const router = express.Router();

function generateId() {
  return crypto.randomUUID();
}

function generatePairTokens() {
  const prefix = crypto.randomBytes(5).toString('hex'); // 10 hex characters e.g. '7k92lmq18f'
  return {
    convId: prefix,
    tokenA: prefix + 'a',
    tokenB: prefix + 'b'
  };
}

export async function findOrCreateConversationByToken(token) {
  if (!token) return null;

  // 1. Direct DB lookup
  let conversation = await queryGet(
    'SELECT * FROM conversations WHERE token_a = ? OR token_b = ? OR id = ?',
    [token, token, token]
  );
  if (conversation) return conversation;

  // 2. Deterministic dual-token fallback for cold serverless environments
  if (token.length === 11 && (token.endsWith('a') || token.endsWith('b'))) {
    const convId = token.slice(0, 10);
    const tokenA = convId + 'a';
    const tokenB = convId + 'b';

    conversation = await queryGet('SELECT * FROM conversations WHERE id = ?', [convId]);
    if (!conversation) {
      // Find user1 if exists
      const dummyUser = await queryGet('SELECT * FROM users LIMIT 1');
      const user1Id = dummyUser ? dummyUser.id : 'pending_user1';
      await queryRun(
        'INSERT INTO conversations (id, token_a, token_b, user1_id) VALUES (?, ?, ?, ?)',
        [convId, tokenA, tokenB, user1Id]
      );
      conversation = await queryGet('SELECT * FROM conversations WHERE id = ?', [convId]);
    }
  }

  return conversation;
}

// 1. Setup Profile & Create Permanent Conversation (Dual Token Generation)
router.post('/setup', async (req, res) => {
  try {
    const { name, avatar, userToken: existingToken } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    let user = null;
    let userToken = null;

    if (existingToken) {
      user = await queryGet('SELECT * FROM users WHERE user_token = ?', [existingToken]);
      if (user) {
        await queryRun('UPDATE users SET name = ?, avatar = ? WHERE id = ?', [name.trim(), avatar || 'avatar-1', user.id]);
        userToken = existingToken;
      }
    }

    if (!user) {
      const userId = generateId();
      userToken = crypto.randomBytes(16).toString('hex');
      await queryRun(
        'INSERT INTO users (id, name, avatar, user_token, is_online) VALUES (?, ?, ?, ?, 1)',
        [userId, name.trim(), avatar || 'avatar-1', userToken]
      );
      user = await queryGet('SELECT * FROM users WHERE id = ?', [userId]);
    }

    // Generate deterministic permanent paired tokens for Participant A and Participant B
    const { convId, tokenA, tokenB } = generatePairTokens();

    await queryRun(
      'INSERT INTO conversations (id, token_a, token_b, user1_id) VALUES (?, ?, ?, ?)',
      [convId, tokenA, tokenB, user.id]
    );

    const conversation = await queryGet('SELECT * FROM conversations WHERE id = ?', [convId]);
    const shareUrl = getShareUrl(req, tokenB);

    return res.json({
      conversation,
      user: { id: user.id, name: user.name, avatar: user.avatar },
      userToken,
      myToken: tokenA,
      partnerToken: tokenB,
      myUrl: `/p/${tokenA}`,
      partnerUrl: `/p/${tokenB}`,
      shareUrl,
      lanShareUrl: shareUrl
    });
  } catch (err) {
    console.error('Setup endpoint error:', err);
    return res.status(500).json({ error: 'Failed to setup private conversation space', details: err.message });
  }
});

// 2. Resolve Conversation Details by Token (/p/:token)
router.get('/p/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const conversation = await findOrCreateConversationByToken(token);

    if (!conversation) {
      return res.status(404).json({ error: 'Private space not found. Please check your link.' });
    }

    const user1 = (conversation.user1_id && conversation.user1_id !== 'pending_user1')
      ? await queryGet('SELECT id, name, avatar, is_online, last_seen FROM users WHERE id = ?', [conversation.user1_id])
      : null;
    const user2 = conversation.user2_id
      ? await queryGet('SELECT id, name, avatar, is_online, last_seen FROM users WHERE id = ?', [conversation.user2_id])
      : null;

    const shareToken = (token === conversation.token_a) ? conversation.token_b : conversation.token_a;
    const shareUrl = getShareUrl(req, shareToken);

    return res.json({
      conversation,
      user1,
      user2,
      participantCount: (user1 ? 1 : 0) + (user2 ? 1 : 0),
      shareToken,
      shareUrl,
      lanShareUrl: shareUrl
    });
  } catch (err) {
    console.error('Resolve token error:', err);
    return res.status(500).json({ error: 'Failed to resolve private space token' });
  }
});

// 3. Join Conversation via Token
router.post('/p/:token/join', async (req, res) => {
  try {
    const { token } = req.params;
    const { name, avatar, userToken: existingToken } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const conversation = await findOrCreateConversationByToken(token);

    if (!conversation) {
      return res.status(404).json({ error: 'Private space not found' });
    }

    let user = null;
    let userToken = null;

    if (existingToken) {
      user = await queryGet('SELECT * FROM users WHERE user_token = ?', [existingToken]);
    }

    if (!user) {
      const userId = generateId();
      userToken = crypto.randomBytes(16).toString('hex');
      await queryRun(
        'INSERT INTO users (id, name, avatar, user_token, is_online) VALUES (?, ?, ?, ?, 1)',
        [userId, name.trim(), avatar || 'avatar-2', userToken]
      );
      user = await queryGet('SELECT * FROM users WHERE id = ?', [userId]);
    } else {
      userToken = existingToken;
      await queryRun('UPDATE users SET name = ?, avatar = ? WHERE id = ?', [name.trim(), avatar || user.avatar, user.id]);
    }

    // Link User 1 or User 2 slot
    if (conversation.user1_id === 'pending_user1' || !conversation.user1_id) {
      await queryRun('UPDATE conversations SET user1_id = ? WHERE id = ?', [user.id, conversation.id]);
    } else if (conversation.user1_id !== user.id && conversation.user2_id !== user.id) {
      if (conversation.user2_id !== null) {
        return res.status(403).json({ error: 'This private conversation is limited to 2 participants.' });
      }
      await queryRun('UPDATE conversations SET user2_id = ? WHERE id = ?', [user.id, conversation.id]);
    }

    const updatedConversation = await queryGet('SELECT * FROM conversations WHERE id = ?', [conversation.id]);
    const shareToken = (token === updatedConversation.token_a) ? updatedConversation.token_b : updatedConversation.token_a;
    const shareUrl = getShareUrl(req, shareToken);

    // Trigger presence update event
    triggerEvent(`private-conversation-${conversation.id}`, 'user_presence', {
      userId: user.id,
      userName: user.name,
      isOnline: true,
      lastSeen: new Date().toISOString()
    });

    return res.json({
      conversation: updatedConversation,
      user: { id: user.id, name: user.name, avatar: user.avatar },
      userToken,
      shareToken,
      shareUrl,
      lanShareUrl: shareUrl
    });
  } catch (err) {
    console.error('Join endpoint error:', err);
    return res.status(500).json({ error: 'Failed to join private conversation' });
  }
});

// 4. Pusher Channel Authentication (Strict Security Check)
router.post('/pusher/auth', authorizeConversationAccess, async (req, res) => {
  try {
    const { socket_id, channel_name } = req.body;
    const user = req.user;
    const conversation = req.conversation;

    if (!socket_id || !channel_name) {
      return res.status(400).json({ error: 'socket_id and channel_name are required' });
    }

    // Verify channel corresponds to authorized conversation
    const expectedChannel = `private-conversation-${conversation.id}`;
    const expectedPresenceChannel = `presence-conversation-${conversation.id}`;

    if (channel_name !== expectedChannel && channel_name !== expectedPresenceChannel) {
      return res.status(403).json({ error: 'Access denied to requested private real-time channel' });
    }

    const presenceData = {
      user_id: user.id,
      user_info: { name: user.name, avatar: user.avatar }
    };

    const authResponse = authenticateChannel(socket_id, channel_name, presenceData);
    return res.json(authResponse);
  } catch (err) {
    console.error('Pusher auth error:', err);
    return res.status(500).json({ error: 'Failed to authenticate Pusher channel' });
  }
});

// 5. Send Message (REST + Pusher Real-time)
router.post('/p/:token/send-message', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;
    const { type = 'text', content, metadata = null, replyToId = null } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }

    const messageId = generateId();
    const createdAt = new Date().toISOString();
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    await queryRun(
      `INSERT INTO messages (id, conversation_id, sender_id, type, content, metadata, reply_to_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [messageId, conversation.id, user.id, type, content.trim(), metadataStr, replyToId, createdAt]
    );

    if (metadata && metadata.url) {
      const sharedLinkId = generateId();
      await queryRun(
        `INSERT INTO shared_links (id, conversation_id, url, title, description, image, domain, shared_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sharedLinkId,
          conversation.id,
          metadata.url,
          metadata.title || metadata.url,
          metadata.description || '',
          metadata.image || null,
          metadata.domain || '',
          user.id
        ]
      );
    }

    const msgObj = await queryGet(
      `SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    const fullMessage = {
      ...msgObj,
      metadata: metadata || null,
      reactions: [],
      isPinned: false
    };

    // Trigger Pusher real-time event
    triggerEvent(`private-conversation-${conversation.id}`, 'new_message', fullMessage);

    return res.json({ success: true, message: fullMessage });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// 6. Typing Indicators (Pusher Real-time)
router.post('/p/:token/typing', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;
    const { isTyping } = req.body;

    triggerEvent(`private-conversation-${conversation.id}`, 'user_typing', {
      userId: user.id,
      userName: user.name,
      isTyping: Boolean(isTyping)
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to trigger typing status' });
  }
});

// 7. Mark Read Receipts (REST + Pusher Real-time)
router.post('/p/:token/mark-read', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;
    const readAt = new Date().toISOString();

    await queryRun(
      `UPDATE messages SET is_read = 1, read_at = ? WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
      [readAt, conversation.id, user.id]
    );

    triggerEvent(`private-conversation-${conversation.id}`, 'messages_read', {
      readByUserId: user.id,
      readAt
    });

    return res.json({ success: true, readAt });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to mark read receipts' });
  }
});

// 8. Toggle Emoji Reaction (REST + Pusher Real-time)
router.post('/p/:token/reaction', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;
    const { messageId, emoji } = req.body;

    if (!messageId || !emoji) {
      return res.status(400).json({ error: 'messageId and emoji are required' });
    }

    const existing = await queryGet(
      'SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [messageId, user.id, emoji]
    );

    let action = '';
    if (existing) {
      await queryRun('DELETE FROM reactions WHERE id = ?', [existing.id]);
      action = 'removed';
    } else {
      const reactionId = generateId();
      await queryRun('INSERT INTO reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)', [
        reactionId,
        messageId,
        user.id,
        emoji
      ]);
      action = 'added';
    }

    const reactions = await queryAll(
      `SELECT r.emoji, r.user_id, u.name as user_name
       FROM reactions r
       JOIN users u ON r.user_id = u.id
       WHERE r.message_id = ?`,
      [messageId]
    );

    triggerEvent(`private-conversation-${conversation.id}`, 'reaction_updated', {
      messageId,
      reactions
    });

    return res.json({ success: true, action, reactions });
  } catch (err) {
    console.error('Reaction toggle error:', err);
    return res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

// 9. Toggle Pin (REST + Pusher Real-time)
router.post('/p/:token/pin', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }

    const existingPin = await queryGet(
      'SELECT id FROM pinned_messages WHERE conversation_id = ? AND message_id = ?',
      [conversation.id, messageId]
    );

    let isPinned = false;
    if (existingPin) {
      await queryRun('DELETE FROM pinned_messages WHERE id = ?', [existingPin.id]);
      isPinned = false;
    } else {
      const pinId = generateId();
      await queryRun('INSERT INTO pinned_messages (id, conversation_id, message_id, pinned_by) VALUES (?, ?, ?, ?)', [
        pinId,
        conversation.id,
        messageId,
        user.id
      ]);
      isPinned = true;
    }

    triggerEvent(`private-conversation-${conversation.id}`, 'pin_updated', {
      messageId,
      isPinned
    });

    return res.json({ success: true, isPinned });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle pin status' });
  }
});

// 10. Edit Message (REST + Pusher Real-time)
router.post('/p/:token/edit-message', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;
    const { messageId, newContent } = req.body;

    if (!messageId || !newContent || !newContent.trim()) {
      return res.status(400).json({ error: 'messageId and newContent are required' });
    }

    const msg = await queryGet('SELECT * FROM messages WHERE id = ? AND sender_id = ?', [messageId, user.id]);
    if (!msg) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await queryRun('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?', [newContent.trim(), messageId]);

    triggerEvent(`private-conversation-${conversation.id}`, 'message_edited', {
      messageId,
      newContent: newContent.trim()
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to edit message' });
  }
});

// 11. Delete Message (REST + Pusher Real-time)
router.post('/p/:token/delete-message', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }

    const msg = await queryGet('SELECT * FROM messages WHERE id = ? AND sender_id = ?', [messageId, user.id]);
    if (!msg) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await queryRun("UPDATE messages SET is_deleted = 1, content = 'This message was deleted' WHERE id = ?", [messageId]);

    triggerEvent(`private-conversation-${conversation.id}`, 'message_deleted', {
      messageId
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

// 12. View Together Active Link Sync (REST + Pusher Real-time)
router.post('/p/:token/active-link', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;
    const { url, title } = req.body;

    await queryRun('UPDATE conversations SET active_link_url = ?, active_link_title = ? WHERE id = ?', [
      url,
      title || url,
      conversation.id
    ]);

    triggerEvent(`private-conversation-${conversation.id}`, 'active_link_changed', {
      url,
      title: title || url,
      setByUserId: user.id
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update active co-browsing link' });
  }
});

// 13. Clear Chat History for Both Participants (REST + Pusher Real-time)
router.post('/p/:token/clear', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;

    await queryRun('DELETE FROM messages WHERE conversation_id = ?', [conversation.id]);
    await queryRun('DELETE FROM shared_links WHERE conversation_id = ?', [conversation.id]);
    await queryRun('DELETE FROM pinned_messages WHERE conversation_id = ?', [conversation.id]);
    await queryRun('UPDATE conversations SET active_link_url = NULL, active_link_title = NULL WHERE id = ?', [conversation.id]);

    triggerEvent(`private-conversation-${conversation.id}`, 'chat_cleared', {
      clearedByUserId: user.id,
      timestamp: new Date().toISOString()
    });

    return res.json({ success: true, message: 'Chat history cleared successfully for both participants' });
  } catch (err) {
    console.error('Clear chat error:', err);
    return res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// 14. Presence Update (Heartbeat)
router.post('/p/:token/presence', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const user = req.user;
    const { isOnline } = req.body;
    const lastSeen = new Date().toISOString();

    await queryRun('UPDATE users SET is_online = ?, last_seen = ? WHERE id = ?', [
      isOnline ? 1 : 0,
      lastSeen,
      user.id
    ]);

    triggerEvent(`private-conversation-${conversation.id}`, 'user_presence', {
      userId: user.id,
      userName: user.name,
      isOnline: Boolean(isOnline),
      lastSeen
    });

    return res.json({ success: true, isOnline: Boolean(isOnline), lastSeen });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update presence' });
  }
});

// 15. Get Messages (Authorized)
router.get('/p/:token/messages', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const currentUser = req.user;

    const partnerId = conversation.user1_id === currentUser.id ? conversation.user2_id : conversation.user1_id;
    const partner = partnerId ? await queryGet('SELECT id, name, avatar, is_online, last_seen FROM users WHERE id = ?', [partnerId]) : null;

    const rawMessages = await queryAll(
      `SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [conversation.id]
    );

    const messages = [];
    for (const msg of rawMessages) {
      let metadata = null;
      try {
        if (msg.metadata) metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
      } catch (e) {}

      const reactions = await queryAll(
        `SELECT r.emoji, r.user_id, u.name as user_name
         FROM reactions r
         JOIN users u ON r.user_id = u.id
         WHERE r.message_id = ?`,
        [msg.id]
      );

      const pinObj = await queryGet(
        'SELECT id FROM pinned_messages WHERE conversation_id = ? AND message_id = ?',
        [conversation.id, msg.id]
      );

      messages.push({
        ...msg,
        metadata,
        reactions,
        isPinned: Boolean(pinObj)
      });
    }

    return res.json({
      conversation,
      partner,
      messages
    });
  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({ error: 'Failed to retrieve conversation messages' });
  }
});

// 16. Get Shared Content (Authorized)
router.get('/p/:token/shared-content', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;

    const links = await queryAll(
      `SELECT sl.*, u.name as shared_by_name
       FROM shared_links sl
       JOIN users u ON sl.shared_by = u.id
       WHERE sl.conversation_id = ?
       ORDER BY sl.created_at DESC`,
      [conversation.id]
    );

    const rawPinned = await queryAll(
      `SELECT pm.id as pin_id, pm.pinned_at, m.*, u.name as sender_name, u.avatar as sender_avatar
       FROM pinned_messages pm
       JOIN messages m ON pm.message_id = m.id
       JOIN users u ON m.sender_id = u.id
       WHERE pm.conversation_id = ?
       ORDER BY pm.pinned_at DESC`,
      [conversation.id]
    );

    const pinned = rawPinned.map((msg) => {
      let metadata = null;
      try {
        if (msg.metadata) metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
      } catch (e) {}
      return { ...msg, metadata };
    });

    const rawMedia = await queryAll(
      `SELECT m.*, u.name as sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ? AND (m.type = 'image' OR m.type = 'file') AND m.is_deleted = 0
       ORDER BY m.created_at DESC`,
      [conversation.id]
    );

    const mediaMessages = rawMedia.map((msg) => {
      let metadata = null;
      try {
        if (msg.metadata) metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
      } catch (e) {}
      return { ...msg, metadata };
    });

    return res.json({ links, pinned, media: mediaMessages });
  } catch (err) {
    console.error('Shared content error:', err);
    return res.status(500).json({ error: 'Failed to retrieve shared content' });
  }
});

// 17. Search Messages (Authorized)
router.get('/p/:token/search', authorizeConversationAccess, async (req, res) => {
  try {
    const conversation = req.conversation;
    const { q } = req.query;

    if (!q || !q.trim()) return res.json({ results: [] });

    const searchTerm = `%${q.trim()}%`;
    const rawResults = await queryAll(
      `SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ? AND m.content LIKE ? AND m.is_deleted = 0
       ORDER BY m.created_at DESC
       LIMIT 30`,
      [conversation.id, searchTerm]
    );

    const results = rawResults.map((msg) => {
      let metadata = null;
      try {
        if (msg.metadata) metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
      } catch (e) {}
      return { ...msg, metadata };
    });

    return res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Failed to search messages' });
  }
});

export default router;
