// otp.service.ts
import { Injectable, BadRequestException, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import { Redis } from 'ioredis';
import { MailService } from './mail.service.js';
import { REDIS_CLIENT } from '../redis/redis.module.js';

const CODE_TTL_S = 10 * 60;
const RESEND_COOLDOWN_S = 60;
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly config: ConfigService,
        private readonly mail: MailService,
    ) { }

    private key(email: string) { return `otp:${email}`; }

    private hash(email: string, code: string): Buffer {
        return createHmac('sha256', this.config.getOrThrow('OTP_SECRET'))
            .update(`${email}:${code}`)
            .digest();
    }

    async requestCode(rawEmail: string): Promise<void> {
        const email = rawEmail.trim().toLowerCase();

        // Resend cooldown (atomic)
        const ok = await this.redis.set(`otp:cooldown:${email}`, '1', 'EX', RESEND_COOLDOWN_S, 'NX');
        if (!ok) {
            throw new HttpException('Please wait before requesting a new code', HttpStatus.TOO_MANY_REQUESTS);
        }

        const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

        await this.redis.set(
            this.key(email),
            JSON.stringify({ hash: this.hash(email, code).toString('hex'), attempts: 0 }),
            'EX',
            CODE_TTL_S,
        ); // overwrites any previous code

        await this.mail.sendVerificationCode(email, code, CODE_TTL_S / 60);
    }

    async verifyCode(rawEmail: string, code: string): Promise<void> {
        const email = rawEmail.trim().toLowerCase();
        const raw = await this.redis.get(this.key(email));
        if (!raw) throw new BadRequestException('Invalid or expired code');

        const data = JSON.parse(raw) as { hash: string; attempts: number };

        if (data.attempts >= MAX_ATTEMPTS) {
            await this.redis.del(this.key(email));
            throw new BadRequestException('Too many attempts, request a new code');
        }

        const expected = Buffer.from(data.hash, 'hex');
        const actual = this.hash(email, code);
        const match = expected.length === actual.length && timingSafeEqual(expected, actual);

        if (!match) {
            // keep the remaining TTL while counting the failed attempt
            await this.redis.set(
                this.key(email),
                JSON.stringify({ ...data, attempts: data.attempts + 1 }),
                'KEEPTTL',
            );
            throw new BadRequestException('Invalid or expired code');
        }

        await this.redis.del(this.key(email)); // single-use
        // mark the email as verified in your DB here
    }
}