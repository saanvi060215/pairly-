import crypto from 'crypto';
import db from './db.js';
import { validateSocketConversationAuth } from './middleware/auth.js';

export function setupSocketHandler(io) {
  const socketUserMap = new Map();

  io.on('connection', (socket) => {
    // 1. Join Permanent Private Conversation
    socket.on('join_conversation', ({ pairToken, userToken }, callback) => {
      const auth = validateSocketConversationAuth(pairToken, userToken);
      if (!auth) {
        if (callback) callback({ error: 'Unauthorized conversation access' });
        return;
      }

      const { user, conversation } = auth;

      socket.join(conversation.id);
      socketUserMap.set(socket.id, { conversationId: conversation.id, pairToken, userId: user.id, userToken });

      db.prepare('UPDATE users SET is_online = 1, socket_id = ? WHERE id = ?').run(socket.id, user.id);

      io.to(conversation.id).emit('user_presence', {
        userId: user.id,
        userName: user.name,
        isOnline: true,
        lastSeen: new Date().toISOString()
      });

      if (callback) {
        callback({
          success: true,
          conversation,
          user
        });
      }
    });

    // 2. Typing Indicators
    socket.on('typing_start', () => {
      const session = socketUserMap.get(socket.id);
      if (!session) return;

      const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(session.userId);
      if (user) {
        socket.to(session.conversationId).emit('user_typing', {
          userId: user.id,
          userName: user.name,
          isTyping: true
        });
      }
    });

    socket.on('typing_stop', () => {
      const session = socketUserMap.get(socket.id);
      if (!session) return;

      socket.to(session.conversationId).emit('user_typing', {
        userId: session.userId,
        isTyping: false
      });
    });

    // 3. Send Message
    socket.on('send_message', ({ type = 'text', content, metadata = null, replyToId = null }, callback) => {
      const session = socketUserMap.get(socket.id);
      if (!session) {
        if (callback) callback({ error: 'Unauthorized' });
        return;
      }

      if (!content || !content.trim()) {
        if (callback) callback({ error: 'Message content cannot be empty' });
        return;
      }

      const messageId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const metadataStr = metadata ? JSON.stringify(metadata) : null;

      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender_id, type, content, metadata, reply_to_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(messageId, session.conversationId, session.userId, type, content.trim(), metadataStr, replyToId, createdAt);

      if (metadata && metadata.url) {
        const sharedLinkId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO shared_links (id, conversation_id, url, title, description, image, domain, shared_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sharedLinkId,
          session.conversationId,
          metadata.url,
          metadata.title || metadata.url,
          metadata.description || '',
          metadata.image || null,
          metadata.domain || '',
          session.userId
        );
      }

      const msgObj = db.prepare(`
        SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `).get(messageId);

      const fullMessage = {
        ...msgObj,
        metadata: metadata || null,
        reactions: [],
        isPinned: false
      };

      io.to(session.conversationId).emit('new_message', fullMessage);

      if (callback) callback({ success: true, message: fullMessage });
    });

    // 4. Clear Chat History in Real-time for Both Participants
    socket.on('clear_chat', (callback) => {
      const session = socketUserMap.get(socket.id);
      if (!session) return;

      db.transaction(() => {
        db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(session.conversationId);
        db.prepare('DELETE FROM shared_links WHERE conversation_id = ?').run(session.conversationId);
        db.prepare('DELETE FROM pinned_messages WHERE conversation_id = ?').run(session.conversationId);
        db.prepare("UPDATE conversations SET active_link_url = NULL, active_link_title = NULL WHERE id = ?").run(session.conversationId);
      })();

      io.to(session.conversationId).emit('chat_cleared', {
        clearedByUserId: session.userId,
        timestamp: new Date().toISOString()
      });

      if (callback) callback({ success: true });
    });

    // 5. Mark Read Receipts
    socket.on('mark_read', ({ messageId }, callback) => {
      const session = socketUserMap.get(socket.id);
      if (!session) return;

      const readAt = new Date().toISOString();

      db.prepare(`
        UPDATE messages
        SET is_read = 1, read_at = ?
        WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
      `).run(readAt, session.conversationId, session.userId);

      io.to(session.conversationId).emit('messages_read', {
        readByUserId: session.userId,
        readAt
      });

      if (callback) callback({ success: true, readAt });
    });

    // 6. Toggle Reactions
    socket.on('toggle_reaction', ({ messageId, emoji }, callback) => {
      const session = socketUserMap.get(socket.id);
      if (!session) return;

      const existing = db.prepare('SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(messageId, session.userId, emoji);

      let action = '';
      if (existing) {
        db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id);
        action = 'removed';
      } else {
        const reactionId = crypto.randomUUID();
        db.prepare('INSERT INTO reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)').run(reactionId, messageId, session.userId, emoji);
        action = 'added';
      }

      const reactions = db.prepare(`
        SELECT r.emoji, r.user_id, u.name as user_name
        FROM reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.message_id = ?
      `).all(messageId);

      io.to(session.conversationId).emit('reaction_updated', { messageId, reactions });

      if (callback) callback({ success: true, action, reactions });
    });

    // 7. Toggle Pin
    socket.on('toggle_pin', ({ messageId }, callback) => {
      const session = socketUserMap.get(socket.id);
      if (!session) return;

      const existingPin = db.prepare('SELECT id FROM pinned_messages WHERE conversation_id = ? AND message_id = ?').get(session.conversationId, messageId);

      let isPinned = false;
      if (existingPin) {
        db.prepare('DELETE FROM pinned_messages WHERE id = ?').run(existingPin.id);
        isPinned = false;
      } else {
        const pinId = crypto.randomUUID();
        db.prepare('INSERT INTO pinned_messages (id, conversation_id, message_id, pinned_by) VALUES (?, ?, ?, ?)').run(pinId, session.conversationId, messageId, session.userId);
        isPinned = true;
      }

      io.to(session.conversationId).emit('pin_updated', { messageId, isPinned });

      if (callback) callback({ success: true, isPinned });
    });

    // 8. Edit Message
    socket.on('edit_message', ({ messageId, newContent }, callback) => {
      const session = socketUserMap.get(socket.id);
      if (!session || !newContent || !newContent.trim()) return;

      const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(messageId, session.userId);
      if (!msg) {
        if (callback) callback({ error: 'Permission denied' });
        return;
      }

      db.prepare('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?').run(newContent.trim(), messageId);

      io.to(session.conversationId).emit('message_edited', { messageId, newContent: newContent.trim() });

      if (callback) callback({ success: true });
    });

    // 9. Delete Message
    socket.on('delete_message', ({ messageId }, callback) => {
      const session = socketUserMap.get(socket.id);
      if (!session) return;

      const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(messageId, session.userId);
      if (!msg) {
        if (callback) callback({ error: 'Permission denied' });
        return;
      }

      db.prepare("UPDATE messages SET is_deleted = 1, content = 'This message was deleted' WHERE id = ?").run(messageId);

      io.to(session.conversationId).emit('message_deleted', { messageId });

      if (callback) callback({ success: true });
    });

    // 10. Co-viewing Link Sync
    socket.on('set_active_link', ({ url, title }, callback) => {
      const session = socketUserMap.get(socket.id);
      if (!session) return;

      db.prepare('UPDATE conversations SET active_link_url = ?, active_link_title = ? WHERE id = ?').run(url, title || url, session.conversationId);

      io.to(session.conversationId).emit('active_link_changed', {
        url,
        title: title || url,
        setByUserId: session.userId
      });

      if (callback) callback({ success: true });
    });

    // 11. Disconnect
    socket.on('disconnect', () => {
      const session = socketUserMap.get(socket.id);
      if (session) {
        socketUserMap.delete(socket.id);
        const lastSeen = new Date().toISOString();

        db.prepare('UPDATE users SET is_online = 0, last_seen = ? WHERE id = ?').run(lastSeen, session.userId);

        io.to(session.conversationId).emit('user_presence', {
          userId: session.userId,
          isOnline: false,
          lastSeen
        });
      }
    });
  });
}
