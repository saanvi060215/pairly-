import React, { useState, useEffect } from 'react';
import LandingPage from './components/landing/LandingPage.jsx';
import ChatContainer from './components/chat/ChatContainer.jsx';
import { useTheme } from './hooks/useTheme.js';

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const [currentUser, setCurrentUser] = useState(null);
  const [userToken, setUserToken] = useState('');
  const [pairToken, setPairToken] = useState('');
  const [targetToken, setTargetToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pathname = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    let tokenFromUrl = '';

    if (pathname.startsWith('/p/')) {
      tokenFromUrl = pathname.split('/p/')[1].split('/')[0].split('?')[0];
    } else if (urlParams.get('p')) {
      tokenFromUrl = urlParams.get('p');
    }

    if (tokenFromUrl) {
      setTargetToken(tokenFromUrl);
    }

    const saved = localStorage.getItem('pairly_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.user && parsed.userToken) {
          setCurrentUser(parsed.user);
          setUserToken(parsed.userToken);

          if (tokenFromUrl) {
            setPairToken(tokenFromUrl);
          } else if (parsed.lastPairToken) {
            setPairToken(parsed.lastPairToken);
          }
        }
      } catch (e) {
        localStorage.removeItem('pairly_session');
      }
    }

    setLoading(false);
  }, []);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  // Helper to parse JSON safely
  const parseJsonResponse = async (res, defaultErrorMsg) => {
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Server API Error (${res.status}): ${text.slice(0, 100) || 'Unable to connect to Netlify API function'}`);
    }
    if (!res.ok) {
      throw new Error(data.error || defaultErrorMsg);
    }
    return data;
  };

  // 1. Initial Setup Profile & Create Permanent Pair Space
  const handleSetupProfile = async ({ name, avatar }) => {
    const res = await fetch(`${API_BASE}/api/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, avatar, userToken })
    });

    const data = await parseJsonResponse(res, 'Failed to setup private space');
    const newSession = {
      user: data.user,
      userToken: data.userToken,
      lastPairToken: data.myToken
    };

    localStorage.setItem('pairly_session', JSON.stringify(newSession));
    setCurrentUser(data.user);
    setUserToken(data.userToken);
    setPairToken(data.myToken);

    window.history.replaceState({}, '', `/p/${data.myToken}`);
  };

  // 2. Join Permanent Pair Space via Shared Link (/p/:token)
  const handleJoinPairToken = async ({ token: tokenToJoin, name, avatar }) => {
    const res = await fetch(`${API_BASE}/api/p/${tokenToJoin}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, avatar, userToken })
    });

    const data = await parseJsonResponse(res, 'Failed to join private space');
    const newSession = {
      user: data.user,
      userToken: data.userToken,
      lastPairToken: tokenToJoin
    };

    localStorage.setItem('pairly_session', JSON.stringify(newSession));
    setCurrentUser(data.user);
    setUserToken(data.userToken);
    setPairToken(tokenToJoin);

    window.history.replaceState({}, '', `/p/${tokenToJoin}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <span className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      {pairToken && currentUser ? (
        <ChatContainer
          pairToken={pairToken}
          currentUser={currentUser}
          userToken={userToken}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <LandingPage
          onSetupProfile={handleSetupProfile}
          onJoinPairToken={handleJoinPairToken}
          targetToken={targetToken}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
