/**
 * Staff identity contract shared by the admin API module and the dashboard.
 *
 * `TDate` follows the same rule as the auth types: `Date` inside Nest, ISO
 * strings over the wire.
 */

/** Staff roles. Exactly one SYSTEM admin bootstraps managers and agents. */
export enum AdminRole {
    SYSTEM = 'system',
    MANAGER = 'manager',
    AGENT = 'agent',
}

/** The only roles the system admin is allowed to create. */
export type CreatableAdminRole = AdminRole.MANAGER | AdminRole.AGENT;

export interface PublicAdmin<TDate = string> {
    id: string;
    username: string;
    role: AdminRole;
    isActive: boolean;
    lastLoginAt: TDate | null;
    createdAt: TDate;
    updatedAt: TDate;
}

/** Request bodies. */
export interface AdminLoginPayload {
    username: string;
    password: string;
    rememberMe?: boolean;
}

export interface CreateAdminPayload {
    username: string;
    password: string;
    /** The API rejects `system` at validation time; only manager/agent can be created. */
    role: AdminRole;
}

export interface ChangeAdminPasswordPayload {
    currentPassword: string;
    newPassword: string;
}

/** Response bodies. */
export interface AdminLoginResponse<TDate = string> {
    admin: PublicAdmin<TDate>;
}
