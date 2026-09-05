import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
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
  const [socket, setSocket] = useState(null);

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

  useEffect(() => {
    fetchConversationData();

    const socketUrl = import.meta.env.VITE_API_URL || undefined;
    const socketIo = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketIo.on('connect', () => {
      setIsConnected(true);
      socketIo.emit('join_conversation', { pairToken, userToken }, (res) => {
        if (res && res.conversation) {
          setConversation(res.conversation);
          fetchConversationData();
        }
      });
    });

    socketIo.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time Socket Events
    socketIo.on('new_message', (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);

      if (newMsg.sender_id !== currentUser.id) {
        playChime();
        socketIo.emit('mark_read', { messageId: newMsg.id });
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

    socketIo.on('chat_cleared', () => {
      setMessages([]);
      setSharedLinks([]);
      setPinnedMessages([]);
      setMediaFiles([]);
      setActiveUrl('');
      setActiveTitle('');
    });

    socketIo.on('user_presence', ({ userId, isOnline, lastSeen }) => {
      setPartner((prev) =>
        prev && prev.id === userId ? { ...prev, is_online: isOnline ? 1 : 0, last_seen: lastSeen } : prev
      );
    });

    socketIo.on('user_typing', ({ userId, userName, isTyping }) => {
      if (userId !== currentUser.id) {
        setTypingUser(isTyping ? { userId, userName } : null);
      }
    });

    socketIo.on('messages_read', ({ readByUserId, readAt }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_id === currentUser.id ? { ...m, is_read: 1, read_at: readAt } : m
        )
      );
    });

    socketIo.on('reaction_updated', ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    });

    socketIo.on('pin_updated', ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m))
      );
      fetchConversationData();
    });

    socketIo.on('message_edited', ({ messageId, newContent }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: newContent, is_edited: 1 } : m
        )
      );
    });

    socketIo.on('message_deleted', ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, is_deleted: 1, content: 'This message was deleted' }
            : m
        )
      );
    });

    socketIo.on('active_link_changed', ({ url, title }) => {
      setActiveUrl(url);
      setActiveTitle(title);
      setShowCollaborative(true);
    });

    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, [pairToken, userToken, currentUser.id, fetchConversationData, playChime]);

  useEffect(() => {
    const handleFocus = () => {
      if (socket && messages.length > 0) {
        const unread = messages.find(m => m.sender_id !== currentUser.id && !m.is_read);
        if (unread) {
          socket.emit('mark_read', { messageId: unread.id });
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [socket, messages, currentUser.id]);

  const handleSendMessage = (msgPayload) => {
    if (socket) socket.emit('send_message', msgPayload);
  };

  const handleTypingStart = () => {
    if (socket) socket.emit('typing_start');
  };

  const handleTypingStop = () => {
    if (socket) socket.emit('typing_stop');
  };

  const handleToggleReaction = (messageId, emoji) => {
    if (socket) socket.emit('toggle_reaction', { messageId, emoji });
  };

  const handleTogglePin = (messageId) => {
    if (socket) socket.emit('toggle_pin', { messageId });
  };

  const handleEditMessage = (messageId, newContent) => {
    if (socket) socket.emit('edit_message', { messageId, newContent });
  };

  const handleDeleteMessage = (messageId) => {
    if (socket) socket.emit('delete_message', { messageId });
  };

  const handleSetActiveLink = (url, title) => {
    setActiveUrl(url);
    setActiveTitle(title || url);
    setShowCollaborative(true);
    if (socket) socket.emit('set_active_link', { url, title: title || url });
  };

  // Smart LAN-Aware Copy Private Link Generator for /p/:token
  const handleCopyPrivateLink = async () => {
    const tokenToCopy = shareToken || pairToken;
    let shareUrl = `${window.location.origin}/p/${tokenToCopy}`;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const res = await fetch('/api/system/lan-info');
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
      if (socket) {
        socket.emit('clear_chat');
      } else {
        await fetch(`/api/p/${pairToken}/clear`, {
          method: 'POST',
          headers: {
            'x-pair-token': pairToken,
            'x-user-token': userToken
          }
        });
      }
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
            typingUser={typingUser}
            pinnedMessages={pinnedMessages}
            onReply={(msg) => setReplyTarget(msg)}
            onToggleReaction={handleToggleReaction}
            onTogglePin={handleTogglePin}
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
            onOpenLightbox={handleOpenLightbox}
            onOpenInCollaborative={handleOpenInCollaborative}
            onCopyPersonalLink={handleCopyPrivateLink}
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
          <div className="w-full md:w-1/2 lg:w-3/5 h-full relative transition-all duration-300">
            <CollaborativeView
              activeUrl={activeUrl}
              activeTitle={activeTitle}
              onClose={() => setShowCollaborative(false)}
              onSetActiveLink={handleSetActiveLink}
              sharedLinks={sharedLinks}
            />
          </div>
        )}

        {showSidebar && (
          <RightSidebar
            connection={conversation}
            partner={partner}
            sharedLinks={sharedLinks}
            mediaFiles={mediaFiles}
            pinnedMessages={pinnedMessages}
            onClose={() => setShowSidebar(false)}
            onOpenInCollaborative={handleOpenInCollaborative}
            onOpenLightbox={handleOpenLightbox}
            onTogglePin={handleTogglePin}
            onCopyPersonalLink={handleCopyPrivateLink}
            onDisconnect={() => setShowClearModal(true)}
          />
        )}
      </div>

      {lightboxImage && (
        <LightboxModal
          imageObj={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {showSearch && (
        <SearchModal
          connectionId={pairToken}
          userToken={userToken}
          onClose={() => setShowSearch(false)}
          onSelectMessage={handleSelectSearchedMessage}
        />
      )}

      {showClearModal && (
        <ClearChatModal
          isOpen={showClearModal}
          onClose={() => setShowClearModal(false)}
          onConfirmClear={handleConfirmClearChat}
          loading={clearing}
        />
      )}
    </div>
  );
}
