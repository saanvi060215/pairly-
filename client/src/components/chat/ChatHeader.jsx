import React, { useState } from 'react';
import { Sparkles, Copy, Check, Search, Columns, FolderKanban, Moon, Sun, Trash2, Link2 } from 'lucide-react';

export default function ChatHeader({
  chat,
  currentUser,
  partner,
  onCopyPrivateChatLink,
  showCollaborative,
  onToggleCollaborative,
  showSidebar,
  onToggleSidebar,
  onOpenSearch,
  theme,
  onToggleTheme,
  onOpenClearModal,
  hasActiveLink
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    onCopyPrivateChatLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between z-10 shrink-0 select-none shadow-sm transition-colors">
      {/* Left: Brand + Partner Status */}
      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
        <div className="flex items-center gap-2 pr-3 border-r border-gray-200 dark:border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Sparkles className="w-4 h-4 text-white fill-current" />
          </div>
          <span className="font-bold text-base text-gray-900 dark:text-white tracking-tight">
            Pairly
          </span>
        </div>

        {partner ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-base text-white font-bold shadow-sm">
                {partner.name[0].toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                  partner.is_online ? 'bg-emerald-500' : 'bg-gray-400'
                }`}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">
                {partner.name}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                {partner.is_online ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online</span>
                ) : (
                  'Offline'
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Share private link to connect...
            </span>
          </div>
        )}
      </div>

      {/* Right Controls Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Copy Private Chat Link */}
        <button
          onClick={handleCopyLink}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            copied
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-slate-700'
          }`}
          title="Copy Private Chat Link"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{copied ? 'Link Copied' : 'Share Link'}</span>
        </button>

        <div className="h-4 w-px bg-gray-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* View Together Split View Toggle */}
        <button
          onClick={onToggleCollaborative}
          className={`relative p-2 rounded-xl text-xs font-medium transition ${
            showCollaborative
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
          title="Toggle View Together Split Panel"
        >
          <Columns className="w-4 h-4" />
          {hasActiveLink && !showCollaborative && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          )}
        </button>

        {/* Search */}
        <button
          onClick={onOpenSearch}
          className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
          title="Search Conversation History"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Shared Content Sidebar */}
        <button
          onClick={onToggleSidebar}
          className={`p-2 rounded-xl transition ${
            showSidebar
              ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
          title="Shared Content & Files"
        >
          <FolderKanban className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>

        {/* Clear Chat Button */}
        <button
          onClick={onOpenClearModal}
          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition ml-1"
          title="Clear Chat History"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
