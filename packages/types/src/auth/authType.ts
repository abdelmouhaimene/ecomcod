import type { MessageResponse } from '../common/apiType.js';

/**
 * Customer identity contract shared by the API modules and the browser apps.
 *
 * `TDate` exists because Nest services hold real `Date` objects while clients
 * receive ISO date strings over JSON. Services use `Shape<Date>`; clients use
 * the default `Shape` (string dates).
 */

export interface PublicUser<TDate = string> {
    id: string;
    email: string;
    fullName: string | null;
    phoneNumber: string | null;
    wilayaCode: string | null;
    wilayaName: string | null;
    communeCode: string | null;
    communeName: string | null;
    isActive: boolean;
    emailVerifiedAt: TDate | null;
    createdAt: TDate;
}

/** Shape returned by GET /v1/auth/me: public data plus auth capabilities. */
export interface MeUser<TDate = string> extends PublicUser<TDate> {
    hasPassword: boolean;
}

/** Browser alias for the /auth/me response. */
export type AuthUser = MeUser;
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

/** Request bodies. */
export interface SignUpPayload {
    email: string;
    password: string;
}

export interface VerifyEmailPayload {
    email: string;
    code: string;
}

export interface LoginPayload {
    email: string;
    password: string;
    rememberMe?: boolean;
}

export interface ForgotPasswordPayload {
    email: string;
}

export interface ResetPasswordPayload {
    email: string;
    code: string;
    password: string;
}

export interface ChangePasswordPayload {
    currentPassword: string;
    newPassword: string;
}

/** Editable delivery contact details stored on the account. */
export interface UpdateProfilePayload {
    fullName: string;
    phoneNumber: string;
    wilayaCode: string;
    wilayaName: string;
    communeCode: string;
    communeName: string;
}

/** Response bodies. */
export type SignUpResponse = MessageResponse;
export type ForgotPasswordResponse = MessageResponse;
export type ChangePasswordResponse = MessageResponse;

export interface VerifyEmailResponse<TDate = string> {
    verified: boolean;
    user: PublicUser<TDate>;
}

export interface LoginResponse<TDate = string> {
    user: PublicUser<TDate>;
}

export interface ResetPasswordResponse<TDate = string> {
    user: PublicUser<TDate>;
}
