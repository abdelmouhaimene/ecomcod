'use client';

import type { ReactNode } from 'react';
import { AuthGuard } from '../auth/auth-guard';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function DashboardShell({ children }: { children: ReactNode }): React.JSX.Element {
    return (
        <AuthGuard>
            <div className="dashboard-shell">
                <Sidebar />
                <div className="dashboard-main">
                    <Topbar />
                    <main className="dashboard-content">{children}</main>
                </div>
            </div>
        </AuthGuard>
    );
}
