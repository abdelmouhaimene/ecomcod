'use client';

import * as React from 'react';
import { apiFetch } from '../lib/api';

/** Public user shape returned by GET /auth/me (dates arrive as ISO strings). */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  /** Re-reads the session cookie; safe to call after login. */
  refresh: () => Promise<void>;
  /** Destroys the server session and forgets the user locally. */
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>('loading');

  const refresh = React.useCallback(async () => {
    try {
      const me = await apiFetch<AuthUser>('/v1/auth/me');
      setUser(me);
      setStatus('authenticated');
    } catch {
      // 401 means "no session"; API/network failures are also treated as
      // logged out so the UI never stays stuck on the loading state.
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = React.useCallback(async () => {
    try {
      await apiFetch<void>('/v1/auth/logout', { method: 'POST' });
    } catch {
      // Even if the API is unreachable, drop the local state.
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
