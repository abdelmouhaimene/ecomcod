import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { EmailAuthController } from './email-auth.controller.js';
import { EmailAuthService } from './email-auth.service.js';
import { SESSION_COOKIE, SessionService } from '../shared/session.service.js';
import { UsersService } from '../../users/users.service.js';
import type { User } from '../../users/entities/user.entity.js';

describe('EmailAuthController', () => {
  let controller: EmailAuthController;
  let authService: {
    signup: ReturnType<typeof vi.fn>;
    verifyEmail: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    forgotPassword: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
  };
  let sessions: {
    create: ReturnType<typeof vi.fn>;
    cookieFor: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    cookieOptions: Record<string, unknown>;
  };
  let users: {
    findByIdWithPassword: ReturnType<typeof vi.fn>;
    toMe: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authService = {
      signup: vi.fn(async () => undefined),
      verifyEmail: vi.fn(async () => undefined),
      login: vi.fn(async () => undefined),
      forgotPassword: vi.fn(async () => undefined),
      resetPassword: vi.fn(async () => undefined),
      changePassword: vi.fn(async () => undefined),
    };
    sessions = {
      create: vi.fn(async () => ({ token: 'token-1', maxAge: 604800000 })),
      cookieFor: vi.fn((session: { maxAge: number | null }) => ({
        httpOnly: true,
        path: '/',
        ...(session.maxAge === null ? {} : { maxAge: session.maxAge }),
      })),
      destroy: vi.fn(async () => undefined),
      cookieOptions: { httpOnly: true, path: '/' },
    };
    users = {
      findByIdWithPassword: vi.fn(async () => null),
      toMe: vi.fn((user: unknown) => user),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailAuthController],
      providers: [
        { provide: EmailAuthService, useValue: authService },
        { provide: SessionService, useValue: sessions },
        { provide: UsersService, useValue: users },
      ],
    }).compile();

    controller = module.get<EmailAuthController>(EmailAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates signup to the service', async () => {
    await controller.signup({ email: 'someone@gmail.com', password: 'secret123' });

    expect(authService.signup).toHaveBeenCalledWith({
      email: 'someone@gmail.com',
      password: 'secret123',
    });
  });

  it('creates the account and a remembered session after verification', async () => {
    const user = { id: 'u1', email: 'someone@gmail.com' } as User;
    const result = { verified: true, user };
    authService.verifyEmail.mockResolvedValueOnce(result);
    const res = { cookie: vi.fn() };

    const returned = await controller.verifyEmail(
      { email: 'someone@gmail.com', code: '123456' },
      res as unknown as Response,
    );

    expect(sessions.create).toHaveBeenCalledWith('u1', true);
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'token-1', {
      httpOnly: true,
      path: '/',
      maxAge: 604800000,
    });
    expect(returned).toBe(result);
  });

  it('creates a persistent session when remember me is checked', async () => {
    const user = { id: 'u1', email: 'someone@gmail.com' } as User;
    authService.login.mockResolvedValueOnce({ user });
    const res = { cookie: vi.fn() };

    await controller.login(
      { email: 'someone@gmail.com', password: 'secret123', rememberMe: true },
      res as unknown as Response,
    );

    expect(sessions.create).toHaveBeenCalledWith('u1', true);
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'token-1', {
      httpOnly: true,
      path: '/',
      maxAge: 604800000,
    });
  });

  it('creates a browser-session cookie when remember me is unchecked', async () => {
    const user = { id: 'u1', email: 'someone@gmail.com' } as User;
    authService.login.mockResolvedValueOnce({ user });
    sessions.create.mockResolvedValueOnce({ token: 'token-1', maxAge: null });
    const res = { cookie: vi.fn() };

    await controller.login(
      { email: 'someone@gmail.com', password: 'secret123' },
      res as unknown as Response,
    );

    expect(sessions.create).toHaveBeenCalledWith('u1', false);
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'token-1', {
      httpOnly: true,
      path: '/',
    });
  });

  it('delegates forgot-password without signing in', async () => {
    authService.forgotPassword.mockResolvedValueOnce({ message: 'sent' });

    const result = await controller.forgotPassword({ email: 'someone@gmail.com' });

    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'someone@gmail.com' });
    expect(result).toEqual({ message: 'sent' });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('signs the user in after a password reset', async () => {
    const user = { id: 'u1', email: 'someone@gmail.com' } as User;
    authService.resetPassword.mockResolvedValueOnce({ user });
    sessions.create.mockResolvedValueOnce({ token: 'token-1', maxAge: null });
    const res = { cookie: vi.fn() };

    await controller.resetPassword(
      { email: 'someone@gmail.com', code: '123456', password: 'newsecret456' },
      res as unknown as Response,
    );

    expect(sessions.create).toHaveBeenCalledWith('u1', false);
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'token-1', {
      httpOnly: true,
      path: '/',
    });
  });

  it('returns the account capabilities for /me', async () => {
    const stored = { id: 'u1', email: 'someone@gmail.com', password: 'hash' } as unknown as User;
    const current = { id: 'u1' } as User;
    users.findByIdWithPassword.mockResolvedValueOnce(stored);
    users.toMe.mockReturnValueOnce({ id: 'u1', hasPassword: true });

    await expect(controller.me(current)).resolves.toEqual({ id: 'u1', hasPassword: true });
    expect(users.findByIdWithPassword).toHaveBeenCalledWith('u1');
    expect(users.toMe).toHaveBeenCalledWith(stored);
  });

  it('still returns /me when the full row cannot be loaded', async () => {
    const current = { id: 'u1' } as User;
    users.toMe.mockReturnValueOnce({ id: 'u1', hasPassword: false });

    await expect(controller.me(current)).resolves.toEqual({ id: 'u1', hasPassword: false });
    expect(users.toMe).toHaveBeenCalledWith(current);
  });

  it('destroys the session and clears the cookie on logout', async () => {
    const req = { cookies: { [SESSION_COOKIE]: 'token-1' } };
    const res = { clearCookie: vi.fn() };

    await controller.logout(
      req as unknown as Request,
      res as unknown as Response,
    );

    expect(sessions.destroy).toHaveBeenCalledWith('token-1');
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, {
      httpOnly: true,
      path: '/',
    });
  });

  it('clears cookies even without a session', async () => {
    const res = { clearCookie: vi.fn() };

    await controller.logout(
      { cookies: {} } as unknown as Request,
      res as unknown as Response,
    );

    expect(sessions.destroy).toHaveBeenCalledWith(undefined);
    expect(res.clearCookie).toHaveBeenCalled();
  });
});
