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
  const [targetConversation, setTargetConversation] = useState(null);
  const [errorState, setErrorState] = useState('');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const initApp = async () => {
      const pathname = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      let tokenFromUrl = '';

      if (pathname.startsWith('/p/')) {
        tokenFromUrl = pathname.split('/p/')[1].split('/')[0].split('?')[0];
      } else if (urlParams.get('p')) {
        tokenFromUrl = urlParams.get('p');
      }

      let savedSession = null;
      try {
        const saved = localStorage.getItem('pairly_session');
        if (saved) savedSession = JSON.parse(saved);
      } catch (e) {
        localStorage.removeItem('pairly_session');
      }

      if (tokenFromUrl) {
        try {
          const res = await fetch(`${API_BASE}/api/p/${tokenFromUrl}`);
          if (res.ok) {
            const data = await res.json();
            const { conversation, user1, user2, participantCount } = data;

            // Check if saved session user belongs to this existing conversation
            const isUser1 = savedSession?.user && user1 && savedSession.user.id === user1.id;
            const isUser2 = savedSession?.user && user2 && savedSession.user.id === user2.id;

            if (isUser1 || isUser2) {
              setCurrentUser(savedSession.user);
              setUserToken(savedSession.userToken);
              setPairToken(tokenFromUrl);
            } else {
              // Not registered yet for this conversation
              if (participantCount < 2) {
                setTargetToken(tokenFromUrl);
                setTargetConversation({ creatorName: user1?.name || 'Your partner' });
              } else {
                setErrorState('This private conversation is full (2/2 participants).');
              }
            }
          } else if (res.status === 404) {
            setErrorState('Private conversation not found. Please check your link or create a new private space.');
          } else {
            const errData = await res.json().catch(() => ({}));
            setErrorState(errData.error || 'Failed to resolve private space link.');
          }
        } catch (err) {
          console.error('Token resolution error:', err);
          setErrorState('Unable to reach private space server. Please check your internet connection.');
        }
      } else if (savedSession?.user && savedSession?.userToken && savedSession?.lastPairToken) {
        // User on home page with existing session
        setCurrentUser(savedSession.user);
        setUserToken(savedSession.userToken);
        setPairToken(savedSession.lastPairToken);
        window.history.replaceState({}, '', `/p/${savedSession.lastPairToken}`);
      }

      setLoading(false);
    };

    initApp();
  }, []);

  // 1. Initial Setup Profile & Create Permanent Pair Space (Only from homepage /)
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

  // 2. Join Existing Permanent Pair Space via Shared Link (/p/:token)
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

  const handleClearErrorAndGoHome = () => {
    setErrorState('');
    setTargetToken('');
    setTargetConversation(null);
    window.history.replaceState({}, '', '/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
        <span className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
        <p className="text-xs text-slate-400 font-medium">Resolving private space...</p>
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
          targetConversation={targetConversation}
          errorState={errorState}
          onClearError={handleClearErrorAndGoHome}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
