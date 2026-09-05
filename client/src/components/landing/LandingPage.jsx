import React, { useState } from 'react';
import { Sparkles, ShieldCheck, Moon, Sun, AlertCircle, ArrowLeft, Users } from 'lucide-react';

const AVATARS = [
  { id: 'avatar-1', bg: 'bg-indigo-500', icon: '🦊', label: 'Fox' },
  { id: 'avatar-2', bg: 'bg-emerald-500', icon: '🐼', label: 'Panda' },
  { id: 'avatar-3', bg: 'bg-amber-500', icon: '🦁', label: 'Lion' },
  { id: 'avatar-4', bg: 'bg-rose-500', icon: '🦉', label: 'Owl' },
  { id: 'avatar-5', bg: 'bg-cyan-500', icon: '🐬', label: 'Dolphin' },
  { id: 'avatar-6', bg: 'bg-purple-500', icon: '🦄', label: 'Unicorn' }
];

export default function LandingPage({
  onSetupProfile,
  onJoinPairToken,
  targetToken = '',
  targetConversation = null,
  errorState = '',
  onClearError,
  theme,
  onToggleTheme
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[1].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter your display name');
    setError('');
    setLoading(true);

    try {
      if (targetToken) {
        let token = targetToken.trim();
        if (token.includes('/p/')) {
          token = token.split('/p/')[1].split('?')[0].split('/')[0];
        }
        await onJoinPairToken({ token, name: name.trim(), avatar });
      } else {
        await onSetupProfile({ name: name.trim(), avatar });
      }
    } catch (err) {
      setError(err.message || 'Failed to initialize private space');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-6 h-6 text-white fill-current" />
          </div>
          <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
            Pairly
          </span>
        </div>

        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 p-8 rounded-3xl shadow-2xl animate-fade-in relative backdrop-blur">
          
          {errorState ? (
            /* Invalid or Full Private Space Error Card */
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Private Space Unavailable</h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                {errorState}
              </p>
              <button
                onClick={onClearError}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition text-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Create New Private Space
              </button>
            </div>
          ) : (
            /* Profile Setup / Join Form */
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  {targetToken ? <Users className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {targetToken ? 'Join Private Space' : 'Create Your Private Space'}
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {targetToken
                    ? `${targetConversation?.creatorName || 'Your partner'} has invited you to join this 1-to-1 private conversation. Enter your name to connect.`
                    : 'Enter your name once to receive your permanent 1-to-1 private conversation link.'}
                </p>
              </div>

              {(error || errorState) && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error || errorState}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sam"
                    maxLength={30}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Choose Avatar
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATARS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAvatar(item.id)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition ${item.bg} ${
                          avatar === item.id
                            ? 'ring-4 ring-indigo-400 scale-110 shadow-lg'
                            : 'opacity-70 hover:opacity-100 hover:scale-105'
                        }`}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  ) : targetToken ? (
                    'Join Private Conversation'
                  ) : (
                    'Create Permanent Private Space'
                  )}
                </button>
              </form>
            </>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-800/80">
        Pairly &copy; 2026 — Dual permanent private URLs for 1-to-1 co-browsing & chatting.
      </footer>
    </div>
  );
}
