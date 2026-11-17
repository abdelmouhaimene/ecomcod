import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { EmailAuthService } from './email-auth.service.js';
import { EmailDomainService } from './email-domain.service.js';
import { OtpService } from './otp.service.js';
import { UsersService } from '../../users/users.service.js';
import { hashPassword, verifyPassword } from '../shared/password.js';

function createRedis() {
    const store = new Map<string, string>();
    return {
        store,
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        set: vi.fn(async (key: string, value: string) => { store.set(key, value); return 'OK'; }),
        del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    };
}

async function rejected(promise: Promise<unknown>): Promise<unknown> {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    throw new Error('Expected the promise to reject');
}

const publicUser = (user: { id: string; email: string }) => ({
    id: user.id,
    email: user.email,
});

describe('EmailAuthService', () => {
    let service: EmailAuthService;
    let otp: {
        requestCode: ReturnType<typeof vi.fn>;
        verifyCode: ReturnType<typeof vi.fn>;
    };
    let emailDomain: { hasValidMailServer: ReturnType<typeof vi.fn> };
    let users: {
        findByEmail: ReturnType<typeof vi.fn>;
        findByIdWithPassword: ReturnType<typeof vi.fn>;
        createWithPassword: ReturnType<typeof vi.fn>;
        save: ReturnType<typeof vi.fn>;
        toPublic: ReturnType<typeof vi.fn>;
    };
    let redis: ReturnType<typeof createRedis>;

    beforeEach(() => {
        otp = {
            requestCode: vi.fn(async () => undefined),
            verifyCode: vi.fn(async () => undefined),
        };
        emailDomain = { hasValidMailServer: vi.fn(async () => true) };
        users = {
            findByEmail: vi.fn(async () => null),
            findByIdWithPassword: vi.fn(async () => null),
            createWithPassword: vi.fn(async (email: string) => ({ id: 'u1', email })),
            save: vi.fn(async (user: unknown) => user),
            toPublic: vi.fn(publicUser),
        };
        redis = createRedis();

        service = new EmailAuthService(
            otp as unknown as OtpService,
            emailDomain as unknown as EmailDomainService,
            users as unknown as UsersService,
            redis as unknown as any,
        );
    });

    describe('signup', () => {
        it('rejects a malformed email before touching Redis', async () => {
            const error = await rejected(service.signup({ email: 'not-an-email', password: 'secret123' }));
            expect(error).toBeInstanceOf(BadRequestException);
            expect(otp.requestCode).not.toHaveBeenCalled();
        });

        it('rejects a short password', async () => {
            const error = await rejected(service.signup({ email: 'someone@gmail.com', password: 'short' }));
            expect(error).toBeInstanceOf(BadRequestException);
            expect(otp.requestCode).not.toHaveBeenCalled();
        });

        it('rejects an email that already has an account', async () => {
            users.findByEmail.mockResolvedValueOnce({ id: 'u1', email: 'someone@gmail.com' });

            const error = await rejected(
                service.signup({ email: 'Someone@Gmail.com', password: 'secret123' }),
            );

            expect(error).toBeInstanceOf(ConflictException);
            expect((error as Error).message).toBe('This email is already in use. Sign in instead.');
            expect(otp.requestCode).not.toHaveBeenCalled();
            expect(redis.store.size).toBe(0);
        });

        it('rejects a domain without a mail server', async () => {
            emailDomain.hasValidMailServer.mockResolvedValueOnce(false);

            const error = await rejected(
                service.signup({ email: 'someone@gmail.com', password: 'secret123' }),
            );

            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as Error).message).toBe('Please use a valid email address');
            expect(otp.requestCode).not.toHaveBeenCalled();
        });

        it('keeps the hashed password in Redis for 10 minutes and sends a code', async () => {
            const result = await service.signup({ email: '  Someone@Gmail.com ', password: 'secret123' });

            expect(emailDomain.hasValidMailServer).toHaveBeenCalledWith('someone@gmail.com');
            expect(otp.requestCode).toHaveBeenCalledWith('someone@gmail.com', 'signup');
            expect(result).toEqual({ message: 'Verification code sent to someone@gmail.com' });

            const raw = redis.store.get('signup:someone@gmail.com');
            expect(raw).toBeDefined();
            const { passwordHash } = JSON.parse(raw as string) as { passwordHash: string };
            expect(passwordHash).not.toContain('secret123');
            await expect(verifyPassword('secret123', passwordHash)).resolves.toBe(true);

            expect(redis.set).toHaveBeenCalledWith(
                'signup:someone@gmail.com',
                expect.any(String),
                'EX',
                600,
            );
        });
    });

    describe('verifyEmail', () => {
        async function pendingSignup(password = 'secret123'): Promise<void> {
            await service.signup({ email: 'someone@gmail.com', password });
        }

        it('creates the account in Postgres once the code is confirmed', async () => {
            await pendingSignup();
            const stored = JSON.parse(redis.store.get('signup:someone@gmail.com') as string) as {
                passwordHash: string;
            };

            const result = await service.verifyEmail({
                email: 'Someone@Gmail.com',
                code: '123456',
            });

            expect(otp.verifyCode).toHaveBeenCalledWith('someone@gmail.com', '123456', 'signup');
            expect(users.createWithPassword).toHaveBeenCalledWith(
                'someone@gmail.com',
                stored.passwordHash,
            );
            expect(users.save).toHaveBeenCalled();
            expect(result).toEqual({
                verified: true,
                user: { id: 'u1', email: 'someone@gmail.com' },
            });
            expect(redis.store.has('signup:someone@gmail.com')).toBe(false);
        });

        it('rejects a confirmation without a pending signup', async () => {
            const error = await rejected(
                service.verifyEmail({ email: 'someone@gmail.com', code: '123456' }),
            );

            expect(error).toBeInstanceOf(BadRequestException);
            expect(users.createWithPassword).not.toHaveBeenCalled();
        });

        it('refuses to create a duplicate if the account appeared meanwhile', async () => {
            await pendingSignup();
            users.findByEmail.mockResolvedValueOnce({ id: 'u1', email: 'someone@gmail.com' });

            const error = await rejected(
                service.verifyEmail({ email: 'someone@gmail.com', code: '123456' }),
            );

            expect(error).toBeInstanceOf(ConflictException);
            expect(users.createWithPassword).not.toHaveBeenCalled();
            expect(redis.store.has('signup:someone@gmail.com')).toBe(false);
        });
    });

    describe('login', () => {
        it('rejects an unknown email with a generic message', async () => {
            const error = await rejected(
                service.login({ email: 'nope@gmail.com', password: 'secret123' }),
            );
            expect(error).toBeInstanceOf(UnauthorizedException);
            expect((error as Error).message).toBe('Invalid email or password');
        });

        it('refuses password login for Google accounts', async () => {
            users.findByEmail.mockResolvedValueOnce({
                id: 'u1',
                email: 'someone@gmail.com',
                googleId: 'google-1',
                password: null,
                isActive: true,
            });

            const error = await rejected(
                service.login({ email: 'someone@gmail.com', password: 'secret123' }),
            );

            expect(error).toBeInstanceOf(UnauthorizedException);
            expect((error as Error).message).toContain('Google');
        });

        it('rejects a wrong password', async () => {
            const hash = await hashPassword('secret123');
            users.findByEmail.mockResolvedValueOnce({
                id: 'u1',
                email: 'someone@gmail.com',
                password: hash,
                isActive: true,
            });

            const error = await rejected(
                service.login({ email: 'someone@gmail.com', password: 'wrong-password' }),
            );
            expect(error).toBeInstanceOf(UnauthorizedException);
            expect(users.save).not.toHaveBeenCalled();
        });

        it('signs in with the correct password and records the login', async () => {
            const hash = await hashPassword('secret123');
            const user = {
                id: 'u1',
                email: 'someone@gmail.com',
                password: hash,
                isActive: true,
                emailVerifiedAt: null as Date | null,
                lastLoginAt: null as Date | null,
            };
            users.findByEmail.mockResolvedValueOnce(user);

            const result = await service.login({
                email: 'someone@gmail.com',
                password: 'secret123',
                rememberMe: true,
            });

            expect(users.save).toHaveBeenCalledWith(user);
            expect(user.lastLoginAt).toBeInstanceOf(Date);
            expect(result).toEqual({ user: { id: 'u1', email: 'someone@gmail.com' } });
        });
    });

    describe('changePassword', () => {
        it('refuses to set a password on a Google account', async () => {
            users.findByIdWithPassword.mockResolvedValueOnce({
                id: 'u1',
                googleId: 'google-1',
                password: null,
            });

            const error = await rejected(
                service.changePassword('u1', {
                    currentPassword: 'whatever',
                    newPassword: 'secret123',
                }),
            );

            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as Error).message).toContain('Google');
            expect(users.save).not.toHaveBeenCalled();
        });

        it('requires the current password', async () => {
            const hash = await hashPassword('secret123');
            users.findByIdWithPassword.mockResolvedValueOnce({ id: 'u1', password: hash });

            const error = await rejected(
                service.changePassword('u1', {
                    currentPassword: 'wrong-password',
                    newPassword: 'newsecret456',
                }),
            );

            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as Error).message).toBe('Current password is incorrect');
        });

        it('stores the new password hash', async () => {
            const hash = await hashPassword('secret123');
            const user = { id: 'u1', password: hash as string | null };
            users.findByIdWithPassword.mockResolvedValueOnce(user);

            const result = await service.changePassword('u1', {
                currentPassword: 'secret123',
                newPassword: 'newsecret456',
            });

            expect(result).toEqual({ message: 'Password updated successfully' });
            expect(user.password).not.toBe(hash);
            await expect(verifyPassword('newsecret456', user.password as string)).resolves.toBe(true);
        });
    });

    describe('forgotPassword', () => {
        it('does not reveal whether the address exists', async () => {
            const result = await service.forgotPassword({ email: 'nope@gmail.com' });

            expect(result).toEqual({
                message: 'If an account exists for this address, a reset code has been sent.',
            });
            expect(otp.requestCode).not.toHaveBeenCalled();
        });

        it('does not send a reset code to Google accounts', async () => {
            users.findByEmail.mockResolvedValueOnce({
                id: 'u1',
                googleId: 'google-1',
                password: null,
                isActive: true,
            });

            await service.forgotPassword({ email: 'someone@gmail.com' });

            expect(otp.requestCode).not.toHaveBeenCalled();
        });

        it('sends a reset code to password accounts', async () => {
            users.findByEmail.mockResolvedValueOnce({
                id: 'u1',
                password: 'stored-hash',
                isActive: true,
            });

            await service.forgotPassword({ email: 'Someone@Gmail.com' });

            expect(otp.requestCode).toHaveBeenCalledWith('someone@gmail.com', 'reset');
        });
    });

    describe('resetPassword', () => {
        it('refuses to set a password on a Google account', async () => {
            users.findByEmail.mockResolvedValueOnce({
                id: 'u1',
                googleId: 'google-1',
                password: null,
                isActive: true,
            });

            const error = await rejected(
                service.resetPassword({
                    email: 'someone@gmail.com',
                    code: '123456',
                    password: 'secret123',
                }),
            );

            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as Error).message).toContain('Google');
            expect(users.save).not.toHaveBeenCalled();
        });

        it('stores the new password for a password account', async () => {
            const user = { id: 'u1', email: 'someone@gmail.com', password: 'old-hash', isActive: true };
            users.findByEmail.mockResolvedValueOnce(user);

            const result = await service.resetPassword({
                email: 'someone@gmail.com',
                code: '123456',
                password: 'newsecret456',
            });

            expect(otp.verifyCode).toHaveBeenCalledWith('someone@gmail.com', '123456', 'reset');
            expect(user.password).not.toBe('old-hash');
            await expect(verifyPassword('newsecret456', user.password)).resolves.toBe(true);
            expect(result).toEqual({ user: { id: 'u1', email: 'someone@gmail.com' } });
        });
    });
});
