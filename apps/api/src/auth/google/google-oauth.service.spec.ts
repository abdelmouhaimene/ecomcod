import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { GoogleOAuthService } from './google-oauth.service.js';

function createRedis() {
  const store = new Map<string, string>();

  return {
    store,
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
  };
}

function createConfig(overrides: Record<string, string | number> = {}): ConfigService {
  const values: Record<string, string | number> = {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    PORT: 3002,
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body };
}

describe('GoogleOAuthService', () => {
  let redis: ReturnType<typeof createRedis>;
  let service: GoogleOAuthService;

  beforeEach(() => {
    redis = createRedis();
    service = new GoogleOAuthService(redis as unknown as Redis, createConfig());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports whether credentials are configured', () => {
    expect(service.isConfigured).toBe(true);

    const unconfigured = new GoogleOAuthService(
      redis as unknown as Redis,
      createConfig({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' }),
    );
    expect(unconfigured.isConfigured).toBe(false);
  });

  it('refuses to start without credentials', async () => {
    const unconfigured = new GoogleOAuthService(
      redis as unknown as Redis,
      createConfig({ GOOGLE_CLIENT_ID: '' }),
    );

    await expect(unconfigured.createState('/')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('stores an opaque, single-use state with the redirect target', async () => {
    const state = await service.createState('/account');

    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(redis.set).toHaveBeenCalledWith(
      `oauth:state:${state}`,
      JSON.stringify({ redirect: '/account' }),
      'EX',
      600,
    );

    await expect(service.consumeState(state)).resolves.toEqual({ redirect: '/account' });
    await expect(service.consumeState(state)).resolves.toBeNull();
    expect(redis.store.has(`oauth:state:${state}`)).toBe(false);
  });

  it('ignores missing or malformed state', async () => {
    await expect(service.consumeState(undefined)).resolves.toBeNull();
    await expect(service.consumeState('unknown')).resolves.toBeNull();

    redis.store.set('oauth:state:broken', 'not-json');
    await expect(service.consumeState('broken')).resolves.toBeNull();
    expect(redis.store.has('oauth:state:broken')).toBe(false);
  });

  it('builds the authorization URL with the configured callback', async () => {
    const url = new URL(service.authorizationUrl('state-1'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3002/api/auth/callback/google',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-1');
  });

  it('prefers GOOGLE_CALLBACK_URL when set', () => {
    const custom = new GoogleOAuthService(
      redis as unknown as Redis,
      createConfig({ GOOGLE_CALLBACK_URL: 'https://api.example.com/auth/google/callback' }),
    );

    expect(new URL(custom.authorizationUrl('s')).searchParams.get('redirect_uri')).toBe(
      'https://api.example.com/auth/google/callback',
    );
  });

  it('exchanges the code server-to-server and returns the access token', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: 'access-token' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.exchangeCode('one-time-code')).resolves.toBe('access-token');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const body = init.body as URLSearchParams;
    expect(body.get('code')).toBe('one-time-code');
    expect(body.get('client_id')).toBe('client-id');
    expect(body.get('client_secret')).toBe('client-secret');
    expect(body.get('redirect_uri')).toBe('http://localhost:3002/api/auth/callback/google');
    expect(body.get('grant_type')).toBe('authorization_code');
  });

  it('fails when Google rejects the token exchange', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'invalid_grant' }, false, 400)));

    await expect(service.exchangeCode('bad')).rejects.toThrow('Google token exchange failed');
  });

  it('fails when the token response has no access token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})));

    await expect(service.exchangeCode('code')).rejects.toThrow('no access_token');
  });

  it('reads the profile with the access token', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        sub: 'google-1',
        email: '  User@Gmail.com ',
        email_verified: true,
        name: '  Jane Doe ',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.getProfile('access-token')).resolves.toEqual({
      googleId: 'google-1',
      email: 'user@gmail.com',
      fullName: 'Jane Doe',
      emailVerified: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openidconnect.googleapis.com/v1/userinfo');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer access-token');
  });

  it('reports an unverified Google email instead of trusting it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ sub: 'google-1', email: 'user@gmail.com', email_verified: false }),
      ),
    );

    await expect(service.getProfile('access-token')).resolves.toMatchObject({
      emailVerified: false,
    });
  });

  it('fails on userinfo errors or an incomplete profile', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, false, 401)));
    await expect(service.getProfile('access-token')).rejects.toThrow('Google userinfo failed');

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ sub: 'only-sub' })));
    await expect(service.getProfile('access-token')).rejects.toThrow('missing sub/email');
  });
});
