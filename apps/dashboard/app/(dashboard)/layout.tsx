import type { ReactNode } from 'react';
import { DashboardShell } from '../../components/layout/dashboard-shell';

export default function DashboardGroupLayout({
    children,
}: {
    children: ReactNode;
}): React.JSX.Element {
    return <DashboardShell>{children}</DashboardShell>;
}
