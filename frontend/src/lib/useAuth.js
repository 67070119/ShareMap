'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api('/api/auth/me');
      setUser(result.user);
    } catch (error) {
      if (error.status === 401) setUser(null);
      else throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    api('/api/auth/me')
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch((error) => {
        if (active && error.status === 401) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return { user, loading, refresh, logout };
}
