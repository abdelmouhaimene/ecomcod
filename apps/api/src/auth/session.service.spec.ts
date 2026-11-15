import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { SessionService } from './session.service.js';

const DEFAULT_TTL_S = 7 * 24 * 60 * 60;

function createConfig(nodeEnv = 'test'): ConfigService {
  return {
    get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
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

  it('creates a random token and stores only its hash', async () => {
    const { token, maxAge } = await service.create('user-1');

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(maxAge).toBe(DEFAULT_TTL_S * 1000);

    const storedKey = hashKey(token);
    expect(storedKey).not.toContain(token);
    expect(redis.set).toHaveBeenCalledWith(storedKey, 'user-1', 'EX', DEFAULT_TTL_S);
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
