import { initDb, queryGet } from '../../server/db.js';

export const handler = async (event) => {
  try {
    await initDb();
    const pathParts = event.path.split('/');
    const token = pathParts[pathParts.length - 1] || event.queryStringParameters?.token;

    if (!token) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Token is required' })
      };
    }

    const conversation = await queryGet(
      'SELECT * FROM conversations WHERE token_a = ? OR token_b = ? OR id = ?',
      [token, token, token]
    );

    if (!conversation) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Private space not found. Please check your link.' })
      };
    }

    const user1 = await queryGet('SELECT id, name, avatar, is_online, last_seen FROM users WHERE id = ?', [conversation.user1_id]);
    const user2 = conversation.user2_id ? await queryGet('SELECT id, name, avatar, is_online, last_seen FROM users WHERE id = ?', [conversation.user2_id]) : null;

    const shareToken = (token === conversation.token_a) ? conversation.token_b : conversation.token_a;
    const host = event.headers['x-forwarded-host'] || event.headers.host || 'solofiy.netlify.app';
    const proto = event.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    const shareUrl = `${proto}://${host}/p/${shareToken}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation,
        user1,
        user2,
        participantCount: user2 ? 2 : 1,
        shareToken,
        shareUrl,
        lanShareUrl: shareUrl
      })
    };
  } catch (err) {
    console.error('Resolve function error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to resolve private space', details: err.message })
    };
  }
};
