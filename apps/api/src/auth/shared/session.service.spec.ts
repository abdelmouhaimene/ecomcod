import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { SessionService } from './session.service.js';

const REMEMBER_TTL_S = 30 * 24 * 60 * 60;
const SHORT_TTL_S = 24 * 60 * 60;

function createConfig(nodeEnv = 'test', values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'NODE_ENV') return nodeEnv;
      return values[key];
    },
  } as unknown as ConfigService;
}

function hashKey(token: string): string {
  return `sess:${createHash('sha256').update(token).digest('hex')}`;
}

describe('SessionService', () => {
  let redis: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };
  let service: SessionService;

  beforeEach(() => {
    redis = {
      set: vi.fn(async () => 'OK'),
      get: vi.fn(async () => 'user-1'),
      del: vi.fn(async () => 1),
    };
    service = new SessionService(redis as unknown as Redis, createConfig());
  });

  it('creates a remembered session with a persistent cookie', async () => {
    const session = await service.create('user-1', true);

    expect(session.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(session.maxAge).toBe(REMEMBER_TTL_S * 1000);

    const storedKey = hashKey(session.token);
    expect(storedKey).not.toContain(session.token);
    expect(redis.set).toHaveBeenCalledWith(storedKey, 'user-1', 'EX', REMEMBER_TTL_S);

    expect(service.cookieFor(session)).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: REMEMBER_TTL_S * 1000,
    });
  });

  it('creates a browser-session cookie when remember me is off', async () => {
    const session = await service.create('user-1');

    expect(session.maxAge).toBeNull();
    expect(redis.set).toHaveBeenCalledWith(hashKey(session.token), 'user-1', 'EX', SHORT_TTL_S);

    const cookie = service.cookieFor(session);
    expect(cookie).toMatchObject({ httpOnly: true, path: '/' });
    expect(cookie).not.toHaveProperty('maxAge');
  });

  it('honours the configured lifetimes', async () => {
    const configured = new SessionService(
      redis as unknown as Redis,
      createConfig('test', { SESSION_TTL_S: '120', SESSION_SHORT_TTL_S: '60' }),
    );

    const remembered = await configured.create('user-1', true);
    expect(remembered.maxAge).toBe(120_000);
    expect(redis.set).toHaveBeenLastCalledWith(hashKey(remembered.token), 'user-1', 'EX', 120);

    const short = await configured.create('user-1');
    expect(short.maxAge).toBeNull();
    expect(redis.set).toHaveBeenLastCalledWith(hashKey(short.token), 'user-1', 'EX', 60);
  });

  it('resolves a user from a token', async () => {
    const token = 'a-token';

    await expect(service.getUserId(token)).resolves.toBe('user-1');
    expect(redis.get).toHaveBeenCalledWith(hashKey(token));
  });

  it('returns null without a token or when the session is gone', async () => {
    await expect(service.getUserId(undefined)).resolves.toBeNull();
    expect(redis.get).not.toHaveBeenCalled();

    redis.get.mockResolvedValueOnce(null);
    await expect(service.getUserId('expired')).resolves.toBeNull();
  });

  it('destroys the session by hashed key', async () => {
    await service.destroy('a-token');

    expect(redis.del).toHaveBeenCalledWith(hashKey('a-token'));
  });

  it('sets cookie flags according to the environment', () => {
    expect(service.cookieOptions).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });

    const production = new SessionService(
      redis as unknown as Redis,
      createConfig('production'),
    );
    expect(production.cookieOptions.secure).toBe(true);
  });
});
