import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  GoogleAuthController,
  safeRedirectPath,
  type GoogleAuthError,
} from './google-auth.controller.js';
import type { GoogleOAuthService } from './google-oauth.service.js';
import { SESSION_COOKIE, type SessionService } from './session.service.js';
import type { UsersService } from '../users/users.service.js';
import type { User } from '../users/entities/user.entity.js';

const config = {
  get: (key: string) => (key === 'FRONTEND_URL' ? 'http://localhost:3000' : undefined),
} as unknown as ConfigService;

function createRes() {
  return { redirect: vi.fn(), cookie: vi.fn() } as unknown as Response;
}

describe('GoogleAuthController', () => {
  let controller: GoogleAuthController;
  let google: {
    isConfigured: boolean;
    createState: ReturnType<typeof vi.fn>;
    authorizationUrl: ReturnType<typeof vi.fn>;
    consumeState: ReturnType<typeof vi.fn>;
    exchangeCode: ReturnType<typeof vi.fn>;
    getProfile: ReturnType<typeof vi.fn>;
  };
  let sessions: { create: ReturnType<typeof vi.fn>; cookieOptions: Record<string, unknown> };
  let users: { findOrCreateByGoogle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    google = {
      isConfigured: true,
      createState: vi.fn(async () => 'state-1'),
      authorizationUrl: vi.fn(() => 'https://accounts.google.com/consent?state=state-1'),
      consumeState: vi.fn(async () => ({ redirect: '/account' })),
      exchangeCode: vi.fn(async () => 'access-token'),
      getProfile: vi.fn(async () => ({
        googleId: 'google-1',
        email: 'user@gmail.com',
        fullName: 'Jane Doe',
        emailVerified: true,
      })),
    };
    sessions = {
      create: vi.fn(async () => ({ token: 'session-token', maxAge: 604800000 })),
      cookieOptions: { httpOnly: true, path: '/' },
    };
    users = {
      findOrCreateByGoogle: vi.fn(async () => ({
        id: 'u1',
        email: 'user@gmail.com',
        isActive: true,
      })),
    };

    controller = new GoogleAuthController(
      google as unknown as GoogleOAuthService,
      sessions as unknown as SessionService,
      users as unknown as UsersService,
      config,
    );
  });

  function lastRedirect(res: Response): string {
    const calls = (res.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls;
    return calls[calls.length - 1][0] as string;
  }

  it('redirects to Google with a server-side state', async () => {
    const res = createRes();

    await controller.start('/account', res);

    expect(google.createState).toHaveBeenCalledWith('/account');
    expect(google.authorizationUrl).toHaveBeenCalledWith('state-1');
    expect(res.redirect).toHaveBeenCalledWith('https://accounts.google.com/consent?state=state-1');
  });

  it('never stores an off-site redirect', async () => {
    const res = createRes();

    await controller.start('//evil.example', res);

    expect(google.createState).toHaveBeenCalledWith('/');
  });

  it('rejects start when Google is not configured', async () => {
    google.isConfigured = false;
    const res = createRes();

    await expect(controller.start('/', res)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('opens the same session cookie as the OTP flow on success', async () => {
    const res = createRes();

    await controller.callback({ code: 'one-time-code', state: 'state-1' }, res);

    expect(google.consumeState).toHaveBeenCalledWith('state-1');
    expect(google.exchangeCode).toHaveBeenCalledWith('one-time-code');
    expect(users.findOrCreateByGoogle).toHaveBeenCalledWith({
      googleId: 'google-1',
      email: 'user@gmail.com',
      fullName: 'Jane Doe',
      emailVerified: true,
    });
    expect(sessions.create).toHaveBeenCalledWith('u1');
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'session-token', {
      httpOnly: true,
      path: '/',
      maxAge: 604800000,
    });
    expect(lastRedirect(res)).toBe('http://localhost:3000/account');
  });

  function expectFailure(res: Response, code: GoogleAuthError, path = '/account') {
    expect(res.cookie).not.toHaveBeenCalled();
    const url = new URL(lastRedirect(res));
    expect(url.origin).toBe('http://localhost:3000');
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get('auth_error')).toBe(code);
  }

  it('rejects an unknown or replayed state', async () => {
    google.consumeState.mockResolvedValueOnce(null);
    const res = createRes();

    await controller.callback({ code: 'one-time-code', state: 'stolen' }, res);

    expectFailure(res, 'invalid_state', '/');
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it('handles the user cancelling the consent screen', async () => {
    const res = createRes();

    await controller.callback({ error: 'access_denied', state: 'state-1' }, res);

    expectFailure(res, 'google_denied');
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it('refuses to link an unverified Google email', async () => {
    google.getProfile.mockResolvedValueOnce({
      googleId: 'google-1',
      email: 'user@gmail.com',
      fullName: null,
      emailVerified: false,
    });
    const res = createRes();

    await controller.callback({ code: 'one-time-code', state: 'state-1' }, res);

    expectFailure(res, 'email_unverified');
    expect(users.findOrCreateByGoogle).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('does not open a session for a disabled account', async () => {
    users.findOrCreateByGoogle.mockResolvedValueOnce({
      id: 'u1',
      email: 'user@gmail.com',
      isActive: false,
    } as User);
    const res = createRes();

    await controller.callback({ code: 'one-time-code', state: 'state-1' }, res);

    expectFailure(res, 'account_disabled');
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('sends the user back with an error when Google fails', async () => {
    google.exchangeCode.mockRejectedValueOnce(new Error('boom'));
    const res = createRes();

    await controller.callback({ code: 'one-time-code', state: 'state-1' }, res);

    expectFailure(res, 'google_failed');
    expect(sessions.create).not.toHaveBeenCalled();
  });
});

describe('safeRedirectPath', () => {
  it.each([
    ['/account', '/account'],
    ['/account?tab=orders', '/account?tab=orders'],
    ['/', '/'],
    ['', '/'],
    [undefined, '/'],
    [null, '/'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    ['/\\evil.example', '/'],
    ['account', '/'],
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
