import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Redis } from 'ioredis';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { REDIS_CLIENT } from '../src/redis/redis.module.js';
import { User } from '../src/users/entities/user.entity.js';

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body };
}

/**
 * Google's endpoints are stubbed at the global `fetch` level: everything else
 * (state handling, user linking, session cookie, redirects) is the real code.
 *
 * Requires the docker Postgres/Redis and real Google credentials in the env,
 * because the service refuses to start the flow otherwise. Tests are skipped
 * when no credentials are configured.
 */
describe('Google OAuth (e2e)', () => {
  let app: INestApplication;
  let redis: Redis;
  let dataSource: DataSource;
  let clientId: string;
  let callbackUrl: string;

  const email = `e2e.google.${Date.now()}@gmail.com`;
  const unverifiedEmail = `e2e.google.unverified.${Date.now()}@gmail.com`;
  const googleId = `google-e2e-${Date.now()}`;
  const states: string[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const config = app.get(ConfigService);
    clientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    callbackUrl = config.get<string>('GOOGLE_CALLBACK_URL') ?? '';

    redis = app.get<Redis>(REDIS_CLIENT);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete([{ email }, { email: unverifiedEmail }]);
    if (states.length > 0) {
      await redis.del(...states.map((state) => `oauth:state:${state}`));
    }
    await app.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startFlow(redirect = '/account'): Promise<string> {
    const response = await request(app.getHttpServer())
      .get('/auth/google')
      .query({ redirect })
      .expect(302);

    const location = new URL(response.headers.location as string);
    const state = location.searchParams.get('state');
    expect(state).toBeTruthy();
    if (state) states.push(state);
    return state as string;
  }

  function stubGoogle(
    verified = true,
    identity: { sub: string; email: string } = { sub: googleId, email },
  ) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes('token')) return jsonResponse({ access_token: 'fake-access-token' });
        return jsonResponse({
          sub: identity.sub,
          email: identity.email,
          email_verified: verified,
          name: 'E2E Google',
        });
      }),
    );
  }

  function sessionCookie(response: SupertestResponse): string {
    const header = response.headers['set-cookie'] as unknown as string[];
    expect(header).toHaveLength(1);
    return header[0].split(';')[0];
  }

  it('sends the browser to Google with a state and the registered callback', async (ctx) => {
    if (!clientId) return ctx.skip();

    const response = await request(app.getHttpServer())
      .get('/auth/google')
      .query({ redirect: '/account' })
      .expect(302);

    const location = new URL(response.headers.location as string);
    states.push(location.searchParams.get('state') as string);

    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('client_id')).toBe(clientId);
    expect(location.searchParams.get('redirect_uri')).toBe(callbackUrl);
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('scope')).toBe('openid email profile');
    expect(location.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('creates the account, opens the session cookie and lands on the app', async (ctx) => {
    if (!clientId) return ctx.skip();

    const state = await startFlow('/account');
    stubGoogle();

    const callback = await request(app.getHttpServer())
      .get('/api/auth/callback/google')
      .query({ code: 'fake-code', state })
      .expect(302);

    expect(callback.headers.location).toBe('http://localhost:3000/account');

    const cookie = sessionCookie(callback);
    expect(cookie).toMatch(/^session=/);
    expect(cookie).not.toContain('fake-access-token');

    const me = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(me.body).toMatchObject({ email, fullName: 'E2E Google', isActive: true });

    const stored = await dataSource.getRepository(User).findOneBy({ email });
    expect(stored?.googleId).toBe(googleId);
    expect(stored?.emailVerifiedAt).toBeInstanceOf(Date);

    // The state is single-use, so replaying the callback cannot log in again.
    vi.unstubAllGlobals();
    const replay = await request(app.getHttpServer())
      .get('/api/auth/callback/google')
      .query({ code: 'fake-code', state })
      .expect(302);
    expect(replay.headers['set-cookie']).toBeUndefined();
    expect(new URL(replay.headers.location as string).searchParams.get('auth_error')).toBe(
      'invalid_state',
    );

    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);
  });

  it('also serves the passport-style /auth/callback/google alias', async (ctx) => {
    if (!clientId) return ctx.skip();

    const state = await startFlow('/');
    stubGoogle();

    const callback = await request(app.getHttpServer())
      .get('/auth/callback/google')
      .query({ code: 'fake-code', state })
      .expect(302);

    expect(callback.headers.location).toBe('http://localhost:3000/');
    const cookie = sessionCookie(callback);

    await request(app.getHttpServer()).get('/v1/auth/me').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).post('/v1/auth/logout').set('Cookie', cookie).expect(204);
  });

  it('refuses an unverified Google email', async (ctx) => {
    if (!clientId) return ctx.skip();

    const state = await startFlow('/');
    stubGoogle(false, { sub: `${googleId}-unverified`, email: unverifiedEmail });

    const callback = await request(app.getHttpServer())
      .get('/api/auth/callback/google')
      .query({ code: 'fake-code', state })
      .expect(302);

    expect(callback.headers['set-cookie']).toBeUndefined();
    expect(new URL(callback.headers.location as string).searchParams.get('auth_error')).toBe(
      'email_unverified',
    );
    expect(await dataSource.getRepository(User).findOneBy({ email: unverifiedEmail })).toBeNull();
  });

  it('reports a denied consent screen without calling Google', async (ctx) => {
    if (!clientId) return ctx.skip();

    const state = await startFlow('/account');

    const callback = await request(app.getHttpServer())
      .get('/api/auth/callback/google')
      .query({ error: 'access_denied', state })
      .expect(302);

    const location = new URL(callback.headers.location as string);
    expect(location.pathname).toBe('/account');
    expect(location.searchParams.get('auth_error')).toBe('google_denied');
    expect(callback.headers['set-cookie']).toBeUndefined();
  });
});
