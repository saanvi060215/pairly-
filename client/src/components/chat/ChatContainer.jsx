import React, { useState, useEffect, useCallback, useRef } from 'react';
import Pusher from 'pusher-js';
import ChatHeader from './ChatHeader.jsx';
import MessageList from './MessageList.jsx';
import MessageComposer from './MessageComposer.jsx';
import CollaborativeView from '../collaborative/CollaborativeView.jsx';
import RightSidebar from '../sidebar/RightSidebar.jsx';
import LightboxModal from '../modals/LightboxModal.jsx';
import SearchModal from '../modals/SearchModal.jsx';
import ClearChatModal from '../modals/ClearChatModal.jsx';
import { useAudio } from '../../hooks/useAudio.js';
import { WifiOff } from 'lucide-react';

export default function ChatContainer({
  pairToken,
  currentUser,
  userToken,
  theme,
  onToggleTheme
}) {
  const [conversation, setConversation] = useState(null);
  const [partner, setPartner] = useState(null);
  const [shareToken, setShareToken] = useState('');
  const [messages, setMessages] = useState([]);
  const [sharedLinks, setSharedLinks] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);

  // UI Panels
  const [showCollaborative, setShowCollaborative] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Active View Together link
  const [activeUrl, setActiveUrl] = useState('');
  const [activeTitle, setActiveTitle] = useState('');

  // Real-time state
  const [typingUser, setTypingUser] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [isConnected, setIsConnected] = useState(true);

  const { playChime } = useAudio();
  const API_BASE = import.meta.env.VITE_API_URL || '';

  // Fetch Conversation Data
  const fetchConversationData = useCallback(async () => {
    try {
      const [msgRes, sharedRes, infoRes] = await Promise.all([
        fetch(`${API_BASE}/api/p/${pairToken}/messages`, {
          headers: { 'x-pair-token': pairToken, 'x-user-token': userToken }
        }),
        fetch(`${API_BASE}/api/p/${pairToken}/shared-content`, {
          headers: { 'x-pair-token': pairToken, 'x-user-token': userToken }
        }),
        fetch(`${API_BASE}/api/p/${pairToken}`)
      ]);

      if (msgRes.ok && msgRes.headers.get('content-type')?.includes('application/json')) {
        const msgData = await msgRes.json();
        setMessages(msgData.messages || []);
        if (msgData.conversation) setConversation(msgData.conversation);
        if (msgData.partner) setPartner(msgData.partner);
        if (msgData.conversation?.active_link_url) setActiveUrl(msgData.conversation.active_link_url);
      }

      if (sharedRes.ok && sharedRes.headers.get('content-type')?.includes('application/json')) {
        const sharedData = await sharedRes.json();
        setSharedLinks(sharedData.links || []);
        setPinnedMessages(sharedData.pinned || []);
        setMediaFiles(sharedData.media || []);
      }

      if (infoRes.ok && infoRes.headers.get('content-type')?.includes('application/json')) {
        const infoData = await infoRes.json();
        if (infoData.shareToken) setShareToken(infoData.shareToken);
      }
    } catch (err) {
      console.error('Failed to fetch conversation data:', err);
    }
  }, [pairToken, userToken, API_BASE]);

  // Real-Time Pusher Connection Setup
  useEffect(() => {
    fetchConversationData();

    const pusherKey = import.meta.env.VITE_PUSHER_KEY;
    const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || 'us2';

    let pusher = null;
    let channel = null;

    if (pusherKey && conversation?.id) {
      try {
        pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          authEndpoint: `${API_BASE}/api/pusher/auth`,
          auth: {
            headers: {
              'x-pair-token': pairToken,
              'x-user-token': userToken
            }
          }
        });

        pusher.connection.bind('connected', () => setIsConnected(true));
        pusher.connection.bind('disconnected', () => setIsConnected(false));
        pusher.connection.bind('error', () => setIsConnected(false));

        channel = pusher.subscribe(`private-conversation-${conversation.id}`);

        channel.bind('new_message', (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (newMsg.sender_id !== currentUser.id) {
            playChime();
            fetch(`${API_BASE}/api/p/${pairToken}/mark-read`, {
              method: 'POST',
              headers: { 'x-pair-token': pairToken, 'x-user-token': userToken }
            }).catch(() => {});
          }

          if (newMsg.metadata && newMsg.metadata.url) {
            setSharedLinks((prev) => [
              {
                id: newMsg.id,
                url: newMsg.metadata.url,
                title: newMsg.metadata.title,
                description: newMsg.metadata.description,
                domain: newMsg.metadata.domain,
                shared_by_name: newMsg.sender_name,
                created_at: newMsg.created_at
              },
              ...prev
            ]);
          }

          if (newMsg.type === 'image' || newMsg.type === 'file') {
            setMediaFiles((prev) => [newMsg, ...prev]);
          }
        });

        channel.bind('chat_cleared', () => {
          setMessages([]);
          setSharedLinks([]);
          setPinnedMessages([]);
          setMediaFiles([]);
          setActiveUrl('');
          setActiveTitle('');
        });

        channel.bind('user_presence', ({ userId, isOnline, lastSeen }) => {
          setPartner((prev) =>
            prev && prev.id === userId ? { ...prev, is_online: isOnline ? 1 : 0, last_seen: lastSeen } : prev
          );
        });

        channel.bind('user_typing', ({ userId, userName, isTyping }) => {
          if (userId !== currentUser.id) {
            setTypingUser(isTyping ? { userId, userName } : null);
          }
        });

        channel.bind('messages_read', ({ readByUserId, readAt }) => {
          setMessages((prev) =>
            prev.map((m) => (m.sender_id === currentUser.id ? { ...m, is_read: 1, read_at: readAt } : m))
          );
        });

        channel.bind('reaction_updated', ({ messageId, reactions }) => {
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
        });

        channel.bind('pin_updated', ({ messageId, isPinned }) => {
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m)));
          fetchConversationData();
        });

        channel.bind('message_edited', ({ messageId, newContent }) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, content: newContent, is_edited: 1 } : m))
          );
        });

        channel.bind('message_deleted', ({ messageId }) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, is_deleted: 1, content: 'This message was deleted' } : m
            )
          );
        });

        channel.bind('active_link_changed', ({ url, title }) => {
          setActiveUrl(url);
          setActiveTitle(title);
          setShowCollaborative(true);
        });
      } catch (err) {
        console.error('Pusher setup error:', err);
      }
    }

    // Polling Fallback (5 seconds interval for robust syncing)
    const pollInterval = setInterval(() => {
      fetchConversationData();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (channel) channel.unbind_all();
      if (pusher) pusher.disconnect();
    };
  }, [pairToken, userToken, conversation?.id, currentUser.id, fetchConversationData, playChime, API_BASE]);

  // Presence Heartbeat
  useEffect(() => {
    const sendPresence = (isOnline) => {
      fetch(`${API_BASE}/api/p/${pairToken}/presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pair-token': pairToken,
          'x-user-token': userToken
        },
        body: JSON.stringify({ isOnline })
      }).catch(() => {});
    };

    sendPresence(true);
    const heartbeat = setInterval(() => sendPresence(true), 30000);

    return () => {
      clearInterval(heartbeat);
      sendPresence(false);
    };
  }, [pairToken, userToken, API_BASE]);

  const handleSendMessage = async (msgPayload) => {
    try {
      const res = await fetch(`${API_BASE}/api/p/${pairToken}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pair-token': pairToken,
          'x-user-token': userToken
        },
        body: JSON.stringify(msgPayload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      }
    } catch (err) {
      console.error('Send message fetch error:', err);
    }
  };

  const handleTypingStart = () => {
    fetch(`${API_BASE}/api/p/${pairToken}/typing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pair-token': pairToken,
        'x-user-token': userToken
      },
      body: JSON.stringify({ isTyping: true })
    }).catch(() => {});
  };

  const handleTypingStop = () => {
    fetch(`${API_BASE}/api/p/${pairToken}/typing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pair-token': pairToken,
        'x-user-token': userToken
      },
      body: JSON.stringify({ isTyping: false })
    }).catch(() => {});
  };

  const handleToggleReaction = async (messageId, emoji) => {
    try {
      const res = await fetch(`${API_BASE}/api/p/${pairToken}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pair-token': pairToken,
          'x-user-token': userToken
        },
        body: JSON.stringify({ messageId, emoji })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reactions) {
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m)));
        }
      }
    } catch (err) {
      console.error('Reaction error:', err);
    }
  };

  const handleTogglePin = async (messageId) => {
    try {
      const res = await fetch(`${API_BASE}/api/p/${pairToken}/pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pair-token': pairToken,
          'x-user-token': userToken
        },
        body: JSON.stringify({ messageId })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isPinned: data.isPinned } : m)));
        fetchConversationData();
      }
    } catch (err) {
      console.error('Pin error:', err);
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      const res = await fetch(`${API_BASE}/api/p/${pairToken}/edit-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pair-token': pairToken,
          'x-user-token': userToken
        },
        body: JSON.stringify({ messageId, newContent })
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content: newContent, is_edited: 1 } : m))
        );
      }
    } catch (err) {
      console.error('Edit error:', err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const res = await fetch(`${API_BASE}/api/p/${pairToken}/delete-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pair-token': pairToken,
          'x-user-token': userToken
        },
        body: JSON.stringify({ messageId })
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, is_deleted: 1, content: 'This message was deleted' } : m
          )
        );
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleSetActiveLink = async (url, title) => {
    setActiveUrl(url);
    setActiveTitle(title || url);
    setShowCollaborative(true);
    try {
      await fetch(`${API_BASE}/api/p/${pairToken}/active-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pair-token': pairToken,
          'x-user-token': userToken
        },
        body: JSON.stringify({ url, title: title || url })
      });
    } catch (err) {
      console.error('Set active link error:', err);
    }
  };

  // Smart LAN-Aware & Production Copy Private Link Generator for /p/:token
  const handleCopyPrivateLink = async () => {
    const tokenToCopy = shareToken || pairToken;
    let shareUrl = `${window.location.origin}/p/${tokenToCopy}`;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const res = await fetch(`${API_BASE}/api/system/lan-info`);
        if (res.ok) {
          const info = await res.json();
          if (info.lanIp && info.lanIp !== '127.0.0.1') {
            shareUrl = `http://${info.lanIp}:${info.port || 5000}/p/${tokenToCopy}`;
          }
        }
      } catch (e) {
        console.warn('LAN IP lookup error:', e);
      }
    }

    navigator.clipboard.writeText(shareUrl);
  };

  const handleConfirmClearChat = async () => {
    setClearing(true);
    try {
      await fetch(`${API_BASE}/api/p/${pairToken}/clear`, {
        method: 'POST',
        headers: {
          'x-pair-token': pairToken,
          'x-user-token': userToken
        }
      });
      setMessages([]);
      setSharedLinks([]);
      setPinnedMessages([]);
      setMediaFiles([]);
      setActiveUrl('');
      setActiveTitle('');
      setShowClearModal(false);
    } catch (e) {
      console.error('Clear chat error:', e);
    } finally {
      setClearing(false);
    }
  };

  const handleOpenInCollaborative = (url, title) => {
    handleSetActiveLink(url, title);
  };

  const handleOpenLightbox = (url, title) => {
    setLightboxImage({ url, title });
  };

  const handleSelectSearchedMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-500', 'rounded-xl');
      setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500', 'rounded-xl'), 3000);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-slate-100 overflow-hidden font-sans select-none">
      {!isConnected && (
        <div className="bg-amber-500 text-slate-900 px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 z-50 animate-pulse">
          <WifiOff className="w-4 h-4" /> Reconnecting to Pairly server...
        </div>
      )}

      <ChatHeader
        chat={conversation}
        currentUser={currentUser}
        partner={partner}
        onCopyPrivateChatLink={handleCopyPrivateLink}
        showCollaborative={showCollaborative}
        onToggleCollaborative={() => setShowCollaborative(!showCollaborative)}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onOpenSearch={() => setShowSearch(true)}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenClearModal={() => setShowClearModal(true)}
        hasActiveLink={!!activeUrl}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          <MessageList
            messages={messages}
            currentUser={currentUser}
            onToggleReaction={handleToggleReaction}
            onTogglePin={handleTogglePin}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onReplyMessage={(msg) => setReplyTarget(msg)}
            onOpenLightbox={handleOpenLightbox}
            onOpenCollaborative={handleOpenInCollaborative}
          />

          <MessageComposer
            onSendMessage={handleSendMessage}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            replyTarget={replyTarget}
            onCancelReply={() => setReplyTarget(null)}
            userToken={userToken}
            connectionId={pairToken}
          />
        </div>

        {showCollaborative && (
          <CollaborativeView
            url={activeUrl}
            title={activeTitle}
            onClose={() => setShowCollaborative(false)}
            onUrlChange={handleSetActiveLink}
          />
        )}

        {showSidebar && (
          <RightSidebar
            partner={partner}
            sharedLinks={sharedLinks}
            pinnedMessages={pinnedMessages}
            mediaFiles={mediaFiles}
            onClose={() => setShowSidebar(false)}
            onOpenCollaborative={handleOpenInCollaborative}
            onOpenLightbox={handleOpenLightbox}
            onUnpinMessage={handleTogglePin}
          />
        )}
      </div>

      {showSearch && (
        <SearchModal
          pairToken={pairToken}
          userToken={userToken}
          onClose={() => setShowSearch(false)}
          onSelectMessage={handleSelectSearchedMessage}
        />
      )}

      {showClearModal && (
        <ClearChatModal
          onClose={() => setShowClearModal(false)}
          onConfirm={handleConfirmClearChat}
          clearing={clearing}
        />
      )}

      {lightboxImage && (
        <LightboxModal
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
