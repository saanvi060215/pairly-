import React, { useRef, useEffect } from 'react';
import MessageItem from './MessageItem.jsx';
import { formatDateDivider } from '../../utils/formatters.js';
import { Sparkles, Pin, Copy } from 'lucide-react';

export default function MessageList({
  messages,
  currentUser,
  typingUser,
  pinnedMessages = [],
  onReply,
  onToggleReaction,
  onTogglePin,
  onEdit,
  onDelete,
  onOpenLightbox,
  onOpenInCollaborative,
  onCopyPersonalLink
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  const groupedMessages = messages.reduce((acc, message) => {
    const dateKey = formatDateDivider(message.created_at);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(message);
    return acc;
  }, {});

  const latestPinned = pinnedMessages.length > 0 ? pinnedMessages[0] : null;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col justify-between relative bg-gray-50/50 dark:bg-slate-900/50">
      {/* Pinned Message Banner */}
      {latestPinned && (
        <div className="sticky top-0 z-10 px-4 py-2 bg-amber-500/10 dark:bg-amber-500/20 backdrop-blur border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2 truncate">
            <Pin className="w-3.5 h-3.5 shrink-0 fill-current" />
            <span className="font-semibold shrink-0">Pinned:</span>
            <span className="truncate italic">{latestPinned.content}</span>
          </div>
          <button
            onClick={() => onTogglePin(latestPinned.id)}
            className="text-xs font-semibold hover:underline shrink-0 ml-2"
          >
            Unpin
          </button>
        </div>
      )}

      {/* Messages Render Container */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in max-w-md mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4 shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Your Private Space is Ready!
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
            Send a message, share an image or document, or paste a URL to explore and view content together.
          </p>
          <button
            onClick={onCopyPersonalLink}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
          >
            <Copy className="w-4 h-4" /> Share My Personal Link
          </button>
        </div>
      ) : (
        <div className="py-4 space-y-6">
          {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
            <div key={dateLabel} className="space-y-1">
              <div className="flex items-center justify-center my-3">
                <span className="px-3 py-1 rounded-full bg-gray-200/70 dark:bg-slate-800 text-[11px] font-semibold text-gray-500 dark:text-slate-400 shadow-sm">
                  {dateLabel}
                </span>
              </div>

              {msgs.map((message) => {
                const parentMessage = message.reply_to_id
                  ? messages.find(m => m.id === message.reply_to_id)
                  : null;
                return (
                  <MessageItem
                    key={message.id}
                    message={message}
                    currentUser={currentUser}
                    onReply={onReply}
                    onToggleReaction={onToggleReaction}
                    onTogglePin={onTogglePin}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onOpenLightbox={onOpenLightbox}
                    onOpenInCollaborative={onOpenInCollaborative}
                    parentMessage={parentMessage}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Typing Indicator */}
      {typingUser && (
        <div className="px-6 py-2 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2 italic animate-fade-in">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>{typingUser.userName} (@{typingUser.userHandle}) is typing...</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
