import React, { useState } from 'react';
import {
  Link2, Image as ImageIcon, FileText, Pin, Info, X, Download,
  UserCheck, UserX, Copy, Check, LogOut, Columns, ShieldAlert
} from 'lucide-react';
import { formatTime, formatFileSize, truncateDomain } from '../../utils/formatters.js';

export default function RightSidebar({
  connection,
  partner,
  sharedLinks = [],
  mediaFiles = [],
  pinnedMessages = [],
  onClose,
  onOpenInCollaborative,
  onOpenLightbox,
  onTogglePin,
  onCopyPersonalLink,
  onDisconnect
}) {
  const [activeTab, setActiveTab] = useState('links');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyPersonalLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-80 h-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col z-20 shrink-0 shadow-lg animate-fade-in transition-colors">
      <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
          Shared Content Hub
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 p-2 bg-gray-50 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 text-xs font-semibold text-gray-600 dark:text-slate-400">
        <button
          onClick={() => setActiveTab('links')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition ${
            activeTab === 'links'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'hover:text-gray-900 dark:hover:text-white'
          }`}
          title="Shared Links"
        >
          <Link2 className="w-4 h-4" />
          <span className="text-[10px]">Links</span>
        </button>

        <button
          onClick={() => setActiveTab('media')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition ${
            activeTab === 'media'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'hover:text-gray-900 dark:hover:text-white'
          }`}
          title="Media & Files"
        >
          <ImageIcon className="w-4 h-4" />
          <span className="text-[10px]">Files</span>
        </button>

        <button
          onClick={() => setActiveTab('pinned')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition ${
            activeTab === 'pinned'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'hover:text-gray-900 dark:hover:text-white'
          }`}
          title="Pinned Messages"
        >
          <Pin className="w-4 h-4" />
          <span className="text-[10px]">Pinned</span>
        </button>

        <button
          onClick={() => setActiveTab('info')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition ${
            activeTab === 'info'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'hover:text-gray-900 dark:hover:text-white'
          }`}
          title="Connection Info"
        >
          <Info className="w-4 h-4" />
          <span className="text-[10px]">Info</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'links' && (
          <div className="space-y-3">
            {sharedLinks.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                No shared links yet. Share any URL in the chat to see it here!
              </div>
            ) : (
              sharedLinks.map((link) => (
                <div
                  key={link.id}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/60 text-xs transition hover:border-indigo-500"
                >
                  <div className="flex items-center justify-between text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase mb-1">
                    <span>{link.domain || truncateDomain(link.url)}</span>
                    <span>{formatTime(link.created_at)}</span>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-gray-900 dark:text-white hover:underline block truncate mb-1"
                  >
                    {link.title || link.url}
                  </a>
                  {link.description && (
                    <p className="text-gray-500 dark:text-slate-400 line-clamp-2 mb-2 text-[11px]">
                      {link.description}
                    </p>
                  )}
                  <button
                    onClick={() => onOpenInCollaborative(link.url, link.title)}
                    className="w-full py-1 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 font-semibold flex items-center justify-center gap-1 text-[11px]"
                  >
                    <Columns className="w-3 h-3" /> View Together
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Images
              </h4>
              {mediaFiles.filter(m => m.type === 'image').length === 0 ? (
                <p className="text-xs text-gray-400 italic">No images shared yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {mediaFiles.filter(m => m.type === 'image').map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => onOpenLightbox(msg.metadata?.url, msg.metadata?.original_name)}
                      className="aspect-square rounded-xl overflow-hidden bg-slate-800 cursor-pointer border border-gray-200 dark:border-slate-700 hover:scale-105 transition"
                    >
                      <img
                        src={msg.metadata?.url}
                        alt={msg.metadata?.original_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Documents & Files
              </h4>
              {mediaFiles.filter(m => m.type === 'file').length === 0 ? (
                <p className="text-xs text-gray-400 italic">No files uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {mediaFiles.filter(m => m.type === 'file').map((msg) => (
                    <div
                      key={msg.id}
                      className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <div className="truncate">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {msg.metadata?.original_name || 'Document'}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-slate-400">
                            {formatFileSize(msg.metadata?.file_size)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={msg.metadata?.url}
                        download={msg.metadata?.original_name}
                        className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pinned' && (
          <div className="space-y-3">
            {pinnedMessages.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                No pinned messages. Hover over any message and click the pin icon!
              </div>
            ) : (
              pinnedMessages.map((msg) => (
                <div
                  key={msg.pin_id || msg.id}
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-gray-800 dark:text-slate-200"
                >
                  <div className="flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400 font-semibold mb-1">
                    <span>{msg.sender_name}</span>
                    <button
                      onClick={() => onTogglePin(msg.id)}
                      className="hover:underline text-[10px]"
                    >
                      Unpin
                    </button>
                  </div>
                  <p className="line-clamp-3">{msg.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="space-y-6 text-xs">
            {partner && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                  Connected Friend
                </label>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center">
                      {partner.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{partner.name}</p>
                      <p className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400">@{partner.handle}</p>
                    </div>
                  </div>
                  {partner.is_online ? (
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <UserX className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                My Shareable Personal Link
              </label>
              <button
                onClick={handleCopy}
                className="w-full p-3 bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-between border border-gray-200 dark:border-slate-700 hover:border-indigo-500 transition"
              >
                <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 truncate">
                  {window.location.origin}/u/{partner?.handle ? '...' : ''}
                </span>
                <span className="p-1 bg-indigo-600 text-white rounded-lg text-[10px] font-semibold shrink-0">
                  {copied ? 'Copied' : 'Copy'}
                </span>
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-slate-800">
              <button
                onClick={onDisconnect}
                className="w-full py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-semibold rounded-xl transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Disconnect Private Space
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
