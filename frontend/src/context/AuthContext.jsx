import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { clearStoredSession, restoreSession } from '../session';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);

  const clearSession = useCallback(() => {
    clearStoredSession(localStorage);
    setToken('');
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      clearSession();
      setInitializing(false);
      return () => { cancelled = true; };
    }

    setToken(storedToken);
    restoreSession(storedToken)
      .then((validatedUser) => {
        if (cancelled) return;
        if (!validatedUser) {
          clearSession();
          return;
        }
        setUser(validatedUser);
        localStorage.setItem('user', JSON.stringify(validatedUser));
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => { cancelled = true; };
  }, [clearSession]);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    clearSession();
    setInitializing(false);
  }, [clearSession]);

  const authFetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) logout();
    return res;
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, authFetch, loading, initializing }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
