import { initDb, queryGet, queryRun } from '../../server/db.js';
import crypto from 'crypto';

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    await initDb();
    let body = {};
    if (typeof event.body === 'string') {
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        body = {};
      }
    } else if (event.body) {
      body = event.body;
    }
    const { name, avatar, userToken: existingToken } = body;

    if (!name || !name.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Display name is required' })
      };
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
      const userId = crypto.randomUUID();
      userToken = crypto.randomBytes(16).toString('hex');
      await queryRun(
        'INSERT INTO users (id, name, avatar, user_token, is_online) VALUES (?, ?, ?, ?, 1)',
        [userId, name.trim(), avatar || 'avatar-1', userToken]
      );
      user = await queryGet('SELECT * FROM users WHERE id = ?', [userId]);
    }

    const conversationId = crypto.randomUUID();
    const tokenA = crypto.randomBytes(5).toString('hex');
    const tokenB = crypto.randomBytes(5).toString('hex');

    await queryRun(
      'INSERT INTO conversations (id, token_a, token_b, user1_id) VALUES (?, ?, ?, ?)',
      [conversationId, tokenA, tokenB, user.id]
    );

    const conversation = await queryGet('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    const host = event.headers['x-forwarded-host'] || event.headers.host || 'solofiy.netlify.app';
    const proto = event.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    const shareUrl = `${proto}://${host}/p/${tokenB}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        conversation,
        user: { id: user.id, name: user.name, avatar: user.avatar },
        userToken,
        myToken: tokenA,
        partnerToken: tokenB,
        myUrl: `/p/${tokenA}`,
        partnerUrl: `/p/${tokenB}`,
        shareUrl,
        lanShareUrl: shareUrl
      })
    };
  } catch (err) {
    console.error('Setup function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to setup private space', details: err.message })
    };
  }
};
