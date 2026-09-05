import Pusher from 'pusher';

let pusherClient = null;

const isPusherConfigured = Boolean(
  process.env.PUSHER_APP_ID &&
  process.env.PUSHER_KEY &&
  process.env.PUSHER_SECRET
);

if (isPusherConfigured) {
  console.log('Initializing Pusher Server Client...');
  pusherClient = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER || 'us2',
    useTLS: true
  });
} else {
  console.log('Pusher environment variables not fully configured. Running in mock/silent pusher mode...');
}

export async function triggerEvent(channel, event, data) {
  if (pusherClient) {
    try {
      await pusherClient.trigger(channel, event, data);
    } catch (err) {
      console.error(`Failed to trigger Pusher event "${event}" on channel "${channel}":`, err);
    }
  } else {
    // console.log(`[Pusher Mock] Channel: ${channel} | Event: ${event}`, data);
  }
}

export function authenticateChannel(socketId, channel, userData = null) {
  if (pusherClient) {
    if (channel.startsWith('presence-')) {
      return pusherClient.authorizeChannel(socketId, channel, userData);
    }
    return pusherClient.authorizeChannel(socketId, channel);
  }
  return { auth: 'mock-auth-token' };
}

export default {
  triggerEvent,
  authenticateChannel,
  isConfigured: () => isPusherConfigured
};
