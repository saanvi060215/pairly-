import { queryGet } from '../db.js';
import { findOrCreateConversationByToken } from '../routes/api.js';

export async function authorizeConversationAccess(req, res, next) {
  try {
    const pairToken = req.headers['x-pair-token'] || req.query.pairToken || req.body?.pairToken || req.params?.token;
    const userToken = req.headers['x-user-token'] || req.query.userToken || req.body?.userToken;

    if (!userToken) {
      return res.status(401).json({ error: 'Missing user authentication token' });
    }

    const user = await queryGet('SELECT * FROM users WHERE user_token = ?', [userToken]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid user session token' });
    }

    req.user = user;

    if (pairToken) {
      const conversation = await findOrCreateConversationByToken(pairToken);

      if (!conversation) {
        return res.status(404).json({ error: 'Permanent private space not found' });
      }

      if (conversation.user1_id !== user.id && conversation.user2_id !== user.id && conversation.user2_id !== null && conversation.user1_id !== 'pending_user1') {
        return res.status(403).json({ error: 'Access denied: You are not authorized for this private space' });
      }

      req.conversation = conversation;
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server authorization error' });
  }
}

export async function validateUserConversationAuth(pairToken, userToken) {
  if (!pairToken || !userToken) return null;
  const user = await queryGet('SELECT * FROM users WHERE user_token = ?', [userToken]);
  if (!user) return null;

  const conversation = await findOrCreateConversationByToken(pairToken);

  if (!conversation) return null;

  if (conversation.user1_id !== user.id && conversation.user2_id !== user.id && conversation.user2_id !== null && conversation.user1_id !== 'pending_user1') {
    return null;
  }

  return { user, conversation };
}
