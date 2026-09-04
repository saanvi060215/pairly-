import React, { useState } from 'react';
import {
  Check, CheckCheck, Smile, Reply, Pin, Edit3, Trash2, ExternalLink,
  FileText, Download, Columns
} from 'lucide-react';
import { formatTime, formatFileSize, truncateDomain } from '../../utils/formatters.js';
import { renderTextWithLinks } from '../../utils/urlDetector.jsx';

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '🔥', '🎉', '😯', '👏'];

export default function MessageItem({
  message,
  currentUser,
  onReply,
  onToggleReaction,
  onTogglePin,
  onEdit,
  onDelete,
  onOpenLightbox,
  onOpenInCollaborative,
  parentMessage
}) {
  const isMe = message.sender_id === currentUser?.id;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const metadata = message.metadata;

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex gap-3 px-4 py-2 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors ${
        isMe ? 'flex-row-reverse' : 'flex-row'
      } ${message.isPinned ? 'bg-amber-500/5 border-l-2 border-amber-500' : ''}`}
    >
      {/* Sender Avatar */}
      <div className="shrink-0 pt-1">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm ${
            isMe ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white'
          }`}
        >
          {isMe ? 'You' : (message.sender_name ? message.sender_name[0].toUpperCase() : 'P')}
        </div>
      </div>

      {/* Message Content Container */}
      <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Header Name & Time */}
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-500 dark:text-slate-400">
          <span className="font-semibold text-gray-700 dark:text-slate-300">
            {isMe ? 'You' : message.sender_name}
          </span>
          <span>{formatTime(message.created_at)}</span>
          {message.is_edited === 1 && <span className="italic text-[10px] text-gray-400">(edited)</span>}
          {message.isPinned && (
            <span className="flex items-center gap-1 text-amber-500 font-medium text-[10px]">
              <Pin className="w-3 h-3 fill-current" /> Pinned
            </span>
          )}
        </div>

        {/* Quoted Reply Box */}
        {parentMessage && (
          <div className="mb-1.5 p-2 rounded-xl bg-gray-100 dark:bg-slate-800 border-l-4 border-indigo-500 text-xs text-gray-600 dark:text-slate-300 max-w-full truncate">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 block">
              {parentMessage.sender_id === currentUser?.id ? 'You' : parentMessage.sender_name}
            </span>
            <p className="truncate italic">{parentMessage.content}</p>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`relative p-3.5 rounded-2xl shadow-sm text-sm break-words transition-all ${
            isMe
              ? 'bg-indigo-600 text-white rounded-tr-none'
              : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700/60 rounded-tl-none'
          } ${message.is_deleted ? 'opacity-60 italic' : ''}`}
        >
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-2">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-2 py-1 bg-black/10 dark:bg-white/10 rounded border border-white/20 text-white dark:text-white text-sm focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2 justify-end text-xs">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-1 text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2 py-1 bg-white text-indigo-700 font-medium rounded shadow"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Text Content */}
              {message.content && (
                <div className="whitespace-pre-wrap">
                  {renderTextWithLinks(message.content)}
                </div>
              )}

              {/* URL Preview Card */}
              {metadata && metadata.url && !message.is_deleted && (
                <div className="mt-3 overflow-hidden rounded-xl bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 text-left transition hover:border-indigo-400">
                  {metadata.image && (
                    <div className="h-32 w-full overflow-hidden bg-slate-900">
                      <img
                        src={metadata.image}
                        alt={metadata.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1">
                      <span>{metadata.domain || truncateDomain(metadata.url)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                    <a
                      href={metadata.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-xs text-gray-900 dark:text-white hover:underline line-clamp-1 block mb-1"
                    >
                      {metadata.title || metadata.url}
                    </a>
                    {metadata.description && (
                      <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-2 mb-2">
                        {metadata.description}
                      </p>
                    )}
                    <button
                      onClick={() => onOpenInCollaborative(metadata.url, metadata.title)}
                      className="w-full py-1.5 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Columns className="w-3.5 h-3.5" /> View Together
                    </button>
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {message.type === 'image' && metadata && metadata.url && (
                <div className="mt-2 rounded-xl overflow-hidden cursor-pointer max-w-sm border border-black/10 dark:border-white/10 group/img relative">
                  <img
                    src={metadata.url}
                    alt={metadata.original_name || 'Uploaded image'}
                    className="w-full max-h-72 object-cover rounded-xl transition duration-200 group-hover/img:scale-105"
                    onClick={() => onOpenLightbox(metadata.url, metadata.original_name)}
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-full">
                      Click to View Full
                    </span>
                  </div>
                </div>
              )}

              {/* File Attachment Card */}
              {message.type === 'file' && metadata && (
                <div className="mt-2 flex items-center gap-3 p-3 rounded-xl bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 min-w-[220px]">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-gray-900 dark:text-white">
                      {metadata.original_name || 'Document'}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400">
                      {formatFileSize(metadata.file_size)}
                    </p>
                  </div>
                  <a
                    href={metadata.url}
                    download={metadata.original_name}
                    className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition shadow"
                    title="Download File"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              )}
            </>
          )}

          {/* Read Receipt Status */}
          {isMe && !message.is_deleted && (
            <div className="flex justify-end mt-1 text-[10px] text-indigo-200">
              {message.is_read ? (
                <span className="flex items-center gap-1 text-cyan-200 font-semibold" title={`Read at ${formatTime(message.read_at)}`}>
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-300" /> Read
                </span>
              ) : (
                <span className="flex items-center gap-1 text-indigo-200" title="Sent">
                  <Check className="w-3.5 h-3.5" /> Sent
                </span>
              )}
            </div>
          )}
        </div>

        {/* Reaction Badges */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(
              message.reactions.reduce((acc, curr) => {
                acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]) => {
              const hasReacted = message.reactions.some(r => r.emoji === emoji && r.user_id === currentUser?.id);
              return (
                <button
                  key={emoji}
                  onClick={() => onToggleReaction(message.id, emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${
                    hasReacted
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px]">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Menu */}
      {!message.is_deleted && (
        <div
          className={`absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-1 shadow-lg z-10 ${
            isMe ? 'right-12' : 'left-12'
          }`}
        >
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-600 dark:text-slate-300 transition"
              title="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-full mb-1 left-0 flex gap-1 p-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-20">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onToggleReaction(message.id, emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="hover:scale-125 transition text-base p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onReply(message)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-600 dark:text-slate-300 transition"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onTogglePin(message.id)}
            className={`p-1 rounded transition ${
              message.isPinned
                ? 'text-amber-500 bg-amber-500/10'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
            title={message.isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {isMe && message.type === 'text' && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-600 dark:text-slate-300 transition"
              title="Edit"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {isMe && (
            <button
              onClick={() => onDelete(message.id)}
              className="p-1 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded text-rose-500 transition"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
