import {
    Injectable,
    BadRequestException,
    ConflictException,
    UnauthorizedException,
    Inject,
} from '@nestjs/common';
import * as mailchecker from 'mailchecker';
import { SignUpDto } from './dto/signup.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { EmailDomainService } from './email-domain.service.js';
import { OtpService } from './otp.service.js';
import { UsersService } from '../../users/users.service.js';
import { hashPassword, verifyPassword } from '../shared/password.js';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module.js';

/** A pending signup lives as long as its verification code: 10 minutes. */
const SIGNUP_TTL_S = 10 * 60;
const MIN_PASSWORD_LENGTH = 8;

interface PendingSignup {
    passwordHash: string;
}

@Injectable()
export class EmailAuthService {
    constructor(
        private readonly otp: OtpService,
        private readonly emailDomain: EmailDomainService,
        private readonly users: UsersService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) { }

    private signupKey(email: string): string {
        return `signup:${email}`;
    }

    /**
     * Step 1 of signup: validate the address, hash the password and keep the
     * whole registration in Redis for 10 minutes. No user row exists yet.
     */
    async signup(dto: SignUpDto) {
        const email = dto.email.trim().toLowerCase();

        if (!mailchecker.isValid(email)) {
            throw new BadRequestException('Please use a permanent email address');
        }

        if (dto.password.length < MIN_PASSWORD_LENGTH) {
            throw new BadRequestException(
                `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
            );
        }

        const existing = await this.users.findByEmail(email);
        if (existing) {
            throw new ConflictException('This email is already in use. Sign in instead.');
        }

        if (!(await this.emailDomain.hasValidMailServer(email))) {
            throw new BadRequestException('Please use a valid email address');
        }

        const passwordHash = await hashPassword(dto.password);
        await this.otp.requestCode(email, 'signup');
        await this.redis.set(
            this.signupKey(email),
            JSON.stringify({ passwordHash } satisfies PendingSignup),
            'EX',
            SIGNUP_TTL_S,
        );

        return { message: `Verification code sent to ${email}` };
    }

    /**
     * Step 2 of signup: the code proves ownership of the address, so the
     * pending registration is written to Postgres and the account is live.
     */
    async verifyEmail(dto: VerifyEmailDto) {
        const email = dto.email.trim().toLowerCase();

        await this.otp.verifyCode(email, dto.code, 'signup');

        const raw = await this.redis.get(this.signupKey(email));
        if (!raw) {
            throw new BadRequestException(
                'Your signup expired. Please create the account again.',
            );
        }

        const existing = await this.users.findByEmail(email);
        if (existing) {
            await this.redis.del(this.signupKey(email));
            throw new ConflictException('This email is already in use. Sign in instead.');
        }

        const { passwordHash } = JSON.parse(raw) as PendingSignup;
        const user = await this.users.createWithPassword(email, passwordHash);
        user.lastLoginAt = new Date();
        await this.users.save(user);
        await this.redis.del(this.signupKey(email));

        return { verified: true, user: this.users.toPublic(user) };
    }

    /** Password-based login for accounts that have a password. */
    async login(dto: LoginDto) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.users.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (!user.password) {
            throw new UnauthorizedException(
                'This account uses Google sign-in. Continue with Google instead.',
            );
        }

        const ok = await verifyPassword(dto.password, user.password);
        if (!ok) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('This account has been disabled');
        }

        if (!user.emailVerifiedAt) {
            user.emailVerifiedAt = new Date();
        }
        user.lastLoginAt = new Date();
        await this.users.save(user);

        return { user: this.users.toPublic(user) };
    }

    /** Change the password of an existing password-backed account. */
    async changePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.users.findByIdWithPassword(userId);
        if (!user) {
            throw new BadRequestException('Account not found');
        }

        // Google-created accounts never have (and never get) a password.
        if (!user.password) {
            throw new BadRequestException(
                'This account uses Google sign-in and cannot set a password.',
            );
        }

        const ok = await verifyPassword(dto.currentPassword, user.password);
        if (!ok) {
            throw new BadRequestException('Current password is incorrect');
        }

        if (dto.newPassword.length < MIN_PASSWORD_LENGTH) {
            throw new BadRequestException(
                `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
            );
        }

        user.password = await hashPassword(dto.newPassword);
        await this.users.save(user);

        return { message: 'Password updated successfully' };
    }

    /**
     * Emails a reset code to password-backed accounts only. The answer never
     * reveals whether the address is registered.
     */
    async forgotPassword(dto: ForgotPasswordDto) {
        const email = dto.email.trim().toLowerCase();

        if (!mailchecker.isValid(email)) {
            throw new BadRequestException('Please use a permanent email address');
        }

        const user = await this.users.findByEmail(email);
        if (user && user.isActive && !user.googleId) {
            await this.otp.requestCode(email, 'reset');
        }

        return { message: 'If an account exists for this address, a reset code has been sent.' };
    }

    /** Exchanges a reset code for a new password. */
    async resetPassword(dto: ResetPasswordDto) {
        const email = dto.email.trim().toLowerCase();

        await this.otp.verifyCode(email, dto.code, 'reset');

        const user = await this.users.findByEmail(email);
        if (!user) {
            throw new BadRequestException('Password reset is not available for this account');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('This account has been disabled');
        }

        if (user.googleId) {
            throw new BadRequestException(
                'This account uses Google sign-in and cannot set a password.',
            );
        }

        user.password = await hashPassword(dto.password);
        user.lastLoginAt = new Date();
        if (!user.emailVerifiedAt) {
            user.emailVerifiedAt = new Date();
        }
        await this.users.save(user);

        return { user: this.users.toPublic(user) };
    }
}
