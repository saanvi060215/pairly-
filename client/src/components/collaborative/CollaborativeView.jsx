import React, { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, X, ShieldAlert, Globe, Copy, Check } from 'lucide-react';
import { truncateDomain } from '../../utils/formatters.js';

export default function CollaborativeView({
  activeUrl,
  activeTitle,
  onClose,
  onSetActiveLink,
  sharedLinks = []
}) {
  const [currentUrl, setCurrentUrl] = useState(activeUrl || '');
  const [inputUrl, setInputUrl] = useState(activeUrl || '');
  const [key, setKey] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeUrl) {
      setCurrentUrl(activeUrl);
      setInputUrl(activeUrl);
    }
  }, [activeUrl]);

  const handleNavigate = (e) => {
    e.preventDefault();
    if (!inputUrl) return;
    let formatted = inputUrl.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'https://' + formatted;
    }
    setCurrentUrl(formatted);
    onSetActiveLink(formatted, formatted);
  };

  const handleRefresh = () => {
    setKey((prev) => prev + 1);
  };

  const handleCopyLink = () => {
    if (!currentUrl) return;
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-white z-10 animate-fade-in shadow-2xl">
      {/* Top Address Bar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center gap-2 shrink-0">
        <button
          onClick={handleRefresh}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <form onSubmit={handleNavigate} className="flex-1 flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:border-indigo-500 transition">
          <Globe className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Paste URL to view together..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none truncate font-mono"
          />
        </form>

        <button
          onClick={handleCopyLink}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          title="Copy URL"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>

        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition"
            title="Open in external browser window"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
          title="Close View Together Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Shared Links Quick Selector */}
      {sharedLinks.length > 0 && (
        <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs shrink-0 no-scrollbar">
          <span className="text-[10px] font-semibold uppercase text-slate-500 shrink-0">Recent Links:</span>
          {sharedLinks.slice(0, 5).map((link) => (
            <button
              key={link.id}
              onClick={() => onSetActiveLink(link.url, link.title)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium truncate max-w-[140px] transition shrink-0 ${
                currentUrl === link.url
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {link.title || truncateDomain(link.url)}
            </button>
          ))}
        </div>
      )}

      {/* Frame Container */}
      {currentUrl ? (
        <div className="flex-1 relative bg-white dark:bg-slate-950 flex flex-col">
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Restricted security sites (Google, etc.) block inline frames.</span>
            </div>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-amber-200 shrink-0"
            >
              Open in New Window
            </a>
          </div>

          <iframe
            key={key}
            src={currentUrl}
            title={activeTitle || 'View Together'}
            className="w-full flex-1 border-none bg-white"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
            <Globe className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">View Together</h3>
          <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
            Share any link in your private space to co-view and discuss online content together.
          </p>
        </div>
      )}
    </div>
  );
}
