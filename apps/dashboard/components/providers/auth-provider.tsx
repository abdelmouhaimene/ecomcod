'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
    AdminLoginPayload,
    AuthStatus,
    PublicAdmin,
} from '@repo/types';
import { adminApi } from '../../lib/admin-api';

interface AuthContextValue {
    admin: PublicAdmin | null;
    status: AuthStatus;
    login: (payload: AdminLoginPayload) => Promise<PublicAdmin>;
    logout: () => Promise<void>;
    refresh: () => Promise<PublicAdmin | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [admin, setAdmin] = useState<PublicAdmin | null>(null);
    const [status, setStatus] = useState<AuthStatus>('loading');

    const refresh = useCallback(async () => {
        try {
            const current = await adminApi.me();
            setAdmin(current);
            setStatus('authenticated');
            return current;
        } catch {
            setAdmin(null);
            setStatus('anonymous');
            return null;
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const login = useCallback(async (payload: AdminLoginPayload) => {
        const response = await adminApi.login(payload);
        setAdmin(response.admin);
        setStatus('authenticated');
        return response.admin;
    }, []);

    const logout = useCallback(async () => {
        try {
            await adminApi.logout();
        } finally {
            setAdmin(null);
            setStatus('anonymous');
        }
    }, []);

    const value = useMemo<AuthContextValue>(() => ({
        admin,
        status,
        login,
        logout,
        refresh,
    }), [admin, status, login, logout, refresh]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside AuthProvider');
    return context;
}
