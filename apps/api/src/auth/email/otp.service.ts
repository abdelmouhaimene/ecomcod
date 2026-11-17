// otp.service.ts
import { Injectable, BadRequestException, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import { Redis } from 'ioredis';
import { MailService } from './mail.service.js';
import { REDIS_CLIENT } from '../../redis/redis.module.js';

const CODE_TTL_S = 10 * 60;
const RESEND_COOLDOWN_S = 60;
const MAX_ATTEMPTS = 5;

/**
 * Codes are namespaced by purpose so a signup code can never be replayed on
 * the password-reset endpoint (and vice versa).
 */
export type OtpPurpose = 'signup' | 'reset';

@Injectable()
export class OtpService {
    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly config: ConfigService,
        private readonly mail: MailService,
    ) { }

    private key(purpose: OtpPurpose, email: string) { return `otp:${purpose}:${email}`; }

    private cooldownKey(purpose: OtpPurpose, email: string) {
        return `otp:cooldown:${purpose}:${email}`;
    }

    private hash(purpose: OtpPurpose, email: string, code: string): Buffer {
        return createHmac('sha256', this.config.getOrThrow('OTP_SECRET'))
            .update(`${purpose}:${email}:${code}`)
            .digest();
    }

    async requestCode(rawEmail: string, purpose: OtpPurpose = 'signup'): Promise<void> {
        const email = rawEmail.trim().toLowerCase();

        // Resend cooldown (atomic)
        const ok = await this.redis.set(
            this.cooldownKey(purpose, email),
            '1',
            'EX',
            RESEND_COOLDOWN_S,
            'NX',
        );
        if (!ok) {
            throw new HttpException('Please wait before requesting a new code', HttpStatus.TOO_MANY_REQUESTS);
        }

        const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

        await this.redis.set(
            this.key(purpose, email),
            JSON.stringify({ hash: this.hash(purpose, email, code).toString('hex'), attempts: 0 }),
            'EX',
            CODE_TTL_S,
        ); // overwrites any previous code

        await this.mail.sendVerificationCode(email, code, CODE_TTL_S / 60);
    }

    async verifyCode(rawEmail: string, code: string, purpose: OtpPurpose = 'signup'): Promise<void> {
        const email = rawEmail.trim().toLowerCase();
        const key = this.key(purpose, email);
        const raw = await this.redis.get(key);
        if (!raw) throw new BadRequestException('Invalid or expired code');

        const data = JSON.parse(raw) as { hash: string; attempts: number };

        if (data.attempts >= MAX_ATTEMPTS) {
            await this.redis.del(key);
            throw new BadRequestException('Too many attempts, request a new code');
        }

        const expected = Buffer.from(data.hash, 'hex');
        const actual = this.hash(purpose, email, code);
        const match = expected.length === actual.length && timingSafeEqual(expected, actual);

        if (!match) {
            // keep the remaining TTL while counting the failed attempt
            await this.redis.set(
                key,
                JSON.stringify({ ...data, attempts: data.attempts + 1 }),
                'KEEPTTL',
            );
            throw new BadRequestException('Invalid or expired code');
        }

        await this.redis.del(key); // single-use
    }
}