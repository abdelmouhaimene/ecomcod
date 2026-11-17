import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { Redis } from 'ioredis';
import type { CookieOptions } from 'express';
import { REDIS_CLIENT } from '../../redis/redis.module.js';

export const SESSION_COOKIE = 'session';
/** Admin sessions use their own cookie, so store and dashboard cannot clash. */
export const ADMIN_SESSION_COOKIE = 'admin_session';

/** Admin session values are prefixed so they can never resolve to a customer. */
const ADMIN_SUBJECT_PREFIX = 'admin:';

/** 30 days, in seconds. Override with SESSION_TTL_S. */
const DEFAULT_TTL_S = 30 * 24 * 60 * 60;
/** 1 day, in seconds. Used when "remember me" is unchecked. Override with SESSION_SHORT_TTL_S. */
const DEFAULT_SHORT_TTL_S = 24 * 60 * 60;

export interface CreatedSession {
    token: string;
    /** `null` for browser-session cookies (no Max-Age). */
    maxAge: number | null;
}

@Injectable()
export class SessionService {
    private readonly ttlS: number;
    private readonly shortTtlS: number;

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly config: ConfigService,
    ) {
        const configured = Number(this.config.get('SESSION_TTL_S'));
        this.ttlS = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_S;

        const configuredShort = Number(this.config.get('SESSION_SHORT_TTL_S'));
        this.shortTtlS =
            Number.isFinite(configuredShort) && configuredShort > 0
                ? configuredShort
                : DEFAULT_SHORT_TTL_S;
    }

    /** Only a hash of the token is stored, so a Redis leak cannot be replayed. */
    private key(token: string): string {
        return `sess:${createHash('sha256').update(token).digest('hex')}`;
    }

    /**
     * Creates a session. With `remember` the cookie is persistent (Max-Age),
     * otherwise it is a browser-session cookie and expires server-side sooner.
     */
    async create(userId: string, remember = false): Promise<CreatedSession> {
        return this.createWithValue(userId, remember);
    }

    /** Creates a session whose subject is an admin rather than a customer. */
    async createForAdmin(adminId: string, remember = false): Promise<CreatedSession> {
        return this.createWithValue(`${ADMIN_SUBJECT_PREFIX}${adminId}`, remember);
    }

    private async createWithValue(value: string, remember: boolean): Promise<CreatedSession> {
        const ttlS = remember ? this.ttlS : this.shortTtlS;
        const token = randomBytes(32).toString('base64url');
        await this.redis.set(this.key(token), value, 'EX', ttlS);
        return { token, maxAge: remember ? ttlS * 1000 : null };
    }

    /** Cookie options for the given session, adding Max-Age only when remembered. */
    cookieFor(session: CreatedSession): CookieOptions {
        return session.maxAge === null
            ? { ...this.cookieOptions }
            : { ...this.cookieOptions, maxAge: session.maxAge };
    }

    async getUserId(token: string | undefined): Promise<string | null> {
        if (!token) return null;
        const value = await this.redis.get(this.key(token));
        return value && !value.startsWith(ADMIN_SUBJECT_PREFIX) ? value : null;
    }

    /** Returns the admin id stored in a session, or null for a customer session. */
    async getAdminId(token: string | undefined): Promise<string | null> {
        if (!token) return null;
        const value = await this.redis.get(this.key(token));
        return value?.startsWith(ADMIN_SUBJECT_PREFIX)
            ? value.slice(ADMIN_SUBJECT_PREFIX.length)
            : null;
    }

    async destroy(token: string | undefined): Promise<void> {
        if (!token) return;
        await this.redis.del(this.key(token));
    }

    get cookieOptions(): CookieOptions {
        return {
            httpOnly: true,
            secure: this.config.get('NODE_ENV') === 'production',
            sameSite: 'lax',
            path: '/',
        };
    }
}
