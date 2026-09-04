import React, { useState } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { formatTime } from '../../utils/formatters.js';

export default function SearchModal({ connectionId, userToken, onClose, onSelectMessage }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/connections/${connectionId}/search?q=${encodeURIComponent(query.trim())}`, {
        headers: {
          'x-connection-id': connectionId,
          'x-user-token': userToken
        }
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur flex items-start justify-center pt-16 p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-gray-900 dark:text-white flex flex-col max-h-[80vh]">
        <form onSubmit={handleSearch} className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversation history, links, and filenames..."
            className="w-full bg-transparent text-sm focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-xs text-gray-400">Searching conversation history...</div>
          ) : searched && results.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              No matching messages found for "{query}".
            </div>
          ) : (
            results.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  onSelectMessage(msg.id);
                  onClose();
                }}
                className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/60 hover:border-indigo-500 cursor-pointer transition flex items-center justify-between group"
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {msg.sender_name}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatTime(msg.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-slate-300 line-clamp-2">
                    {msg.content}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
