import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setSessionToken, setUnauthorizedHandler } from './api.js';

const STORAGE_KEY = 'daraja.session';
const AuthContext = createContext(null);

function readStoredToken() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(value) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts for this tab only.
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState(() => {
    const stored = readStoredToken();
    setSessionToken(stored);
    return { user: null, status: stored ? 'loading' : 'signed-out' };
  });

  const signOut = useCallback(() => {
    storeToken(null);
    setSessionToken(null);
    queryClient.clear();
    setState({ user: null, status: 'signed-out' });
  }, [queryClient]);

  const startSession = useCallback(
    (token, user) => {
      storeToken(token);
      setSessionToken(token);
      queryClient.clear();
      setState({ user, status: 'signed-in' });
    },
    [queryClient],
  );

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (state.status !== 'loading') return;
    let cancelled = false;
    api('/auth/me')
      .then(({ user }) => !cancelled && setState({ user, status: 'signed-in' }))
      .catch(() => !cancelled && signOut());
    return () => {
      cancelled = true;
    };
  }, [signOut, state.status]);

  const value = useMemo(
    () => ({
      user: state.user,
      status: state.status,
      async signIn(email, password) {
        const { token, user } = await api('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        startSession(token, user);
        return user;
      },
      async register(details) {
        const { token, user } = await api('/auth/register', { method: 'POST', body: details });
        startSession(token, user);
        return user;
      },
      /** Replace the cached user after a profile change. */
      setUser(user) {
        setState((s) => ({ ...s, user }));
      },
      signOut,
    }),
    [signOut, startSession, state.status, state.user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
