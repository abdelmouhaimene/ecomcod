import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { Redis } from 'ioredis';
import type { CookieOptions } from 'express';
import { REDIS_CLIENT } from '../redis/redis.module.js';

export const SESSION_COOKIE = 'session';

/** 7 days, in seconds. Override with SESSION_TTL_S. */
const DEFAULT_TTL_S = 7 * 24 * 60 * 60;

@Injectable()
export class SessionService {
    private readonly ttlS: number;

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly config: ConfigService,
    ) {
        const configured = Number(this.config.get('SESSION_TTL_S'));
        this.ttlS = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_S;
    }

    /** Only a hash of the token is stored, so a Redis leak cannot be replayed. */
    private key(token: string): string {
        return `sess:${createHash('sha256').update(token).digest('hex')}`;
    }

    async create(userId: string): Promise<{ token: string; maxAge: number }> {
        const token = randomBytes(32).toString('base64url');
        await this.redis.set(this.key(token), userId, 'EX', this.ttlS);
        return { token, maxAge: this.ttlS * 1000 };
    }

    async getUserId(token: string | undefined): Promise<string | null> {
        if (!token) return null;
        return this.redis.get(this.key(token));
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
