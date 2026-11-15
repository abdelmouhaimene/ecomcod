import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE, SessionService } from './session.service.js';
import { UsersService } from '../users/users.service.js';
import type { User } from '../users/entities/user.entity.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    signup: ReturnType<typeof vi.fn>;
    verifyEmail: ReturnType<typeof vi.fn>;
  };
  let sessions: {
    create: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    cookieOptions: Record<string, unknown>;
  };
  let users: { toPublic: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      signup: vi.fn(async () => undefined),
      verifyEmail: vi.fn(async () => undefined),
    };
    sessions = {
      create: vi.fn(async () => ({ token: 'token-1', maxAge: 604800000 })),
      destroy: vi.fn(async () => undefined),
      cookieOptions: { httpOnly: true, path: '/' },
    };
    users = { toPublic: vi.fn((user: unknown) => user) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SessionService, useValue: sessions },
        { provide: UsersService, useValue: users },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates signup to the service', async () => {
    await controller.signup({ email: 'someone@gmail.com' });

    expect(authService.signup).toHaveBeenCalledWith({ email: 'someone@gmail.com' });
  });

  it('sets the session cookie after verification', async () => {
    const user = { id: 'u1', email: 'someone@gmail.com' } as User;
    const result = { verified: true, user };
    authService.verifyEmail.mockResolvedValueOnce(result);
    const res = { cookie: vi.fn() };

    const returned = await controller.verifyEmail(
      { email: 'someone@gmail.com', code: '123456' },
      res as unknown as Response,
    );

    expect(sessions.create).toHaveBeenCalledWith('u1');
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'token-1', {
      httpOnly: true,
      path: '/',
      maxAge: 604800000,
    });
    expect(returned).toBe(result);
  });

  it('returns the public user for /me', () => {
    const user = { id: 'u1' } as User;
    users.toPublic.mockReturnValueOnce({ id: 'u1' });

    expect(controller.me(user)).toEqual({ id: 'u1' });
    expect(users.toPublic).toHaveBeenCalledWith(user);
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
