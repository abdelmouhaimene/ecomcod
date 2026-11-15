import { BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { MailService } from './mail.service.js';
import { OtpService } from './otp.service.js';

const CODE_TTL_S = 600;

function createRedis() {
  const store = new Map<string, string>();

  return {
    store,
    set: vi.fn(async (key: string, value: string, ...args: string[]) => {
      if (args.includes('NX') && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
  };
}

const config = {
  getOrThrow: (key: string) => {
    if (key === 'OTP_SECRET') return 'test-secret';
    throw new Error(`Missing config ${key}`);
  },
} as unknown as ConfigService;

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

describe('OtpService', () => {
  let redis: ReturnType<typeof createRedis>;
  let mail: { sendVerificationCode: ReturnType<typeof vi.fn> };
  let service: OtpService;

  const email = 'user@example.com';
  const key = `otp:${email}`;

  function lastCode(): string {
    const calls = mail.sendVerificationCode.mock.calls;
    return calls[calls.length - 1][1] as string;
  }

  function wrongCode(code: string): string {
    return code === '000000' ? '000001' : '000000';
  }

  beforeEach(() => {
    redis = createRedis();
    mail = { sendVerificationCode: vi.fn(async () => undefined) };
    service = new OtpService(
      redis as unknown as Redis,
      config,
      mail as unknown as MailService,
    );
  });

  it('stores only a hash and emails the 6-digit code', async () => {
    await service.requestCode('  User@Example.com ');

    const [sentEmail, code, ttlMinutes] = mail.sendVerificationCode.mock.calls[0];
    expect(sentEmail).toBe(email);
    expect(code).toMatch(/^\d{6}$/);
    expect(ttlMinutes).toBe(CODE_TTL_S / 60);

    const raw = redis.store.get(key);
    expect(raw).toBeDefined();

    const data = JSON.parse(raw as string) as { hash: string; attempts: number };
    expect(data.attempts).toBe(0);
    expect(data.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.hash).not.toContain(code as string);

    expect(redis.set).toHaveBeenCalledWith(`otp:cooldown:${email}`, '1', 'EX', 60, 'NX');
    expect(redis.set).toHaveBeenCalledWith(key, expect.any(String), 'EX', CODE_TTL_S);
  });

  it('rejects a second request during the resend cooldown', async () => {
    await service.requestCode(email);

    const error = await rejected(service.requestCode(email));
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);

    expect(mail.sendVerificationCode).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown or expired code', async () => {
    const error = await rejected(service.verifyCode(email, '123456'));
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('counts failed attempts while keeping the entry', async () => {
    await service.requestCode(email);
    const code = lastCode();

    const error = await rejected(service.verifyCode(email, wrongCode(code)));
    expect(error).toBeInstanceOf(BadRequestException);

    const data = JSON.parse(redis.store.get(key) as string) as { attempts: number };
    expect(data.attempts).toBe(1);
    expect(redis.set).toHaveBeenLastCalledWith(key, expect.any(String), 'KEEPTTL');
  });

  it('invalidates the code after too many failed attempts', async () => {
    await service.requestCode(email);
    const code = wrongCode(lastCode());

    for (let attempt = 0; attempt < 5; attempt++) {
      await rejected(service.verifyCode(email, code));
    }

    const error = await rejected(service.verifyCode(email, code));
    expect((error as Error).message).toBe('Too many attempts, request a new code');
    expect(redis.store.has(key)).toBe(false);
  });

  it('accepts the correct code once and makes it single-use', async () => {
    await service.requestCode(email);
    const code = lastCode();

    await expect(service.verifyCode('USER@example.com', code)).resolves.toBeUndefined();
    expect(redis.store.has(key)).toBe(false);

    const reused = await rejected(service.verifyCode(email, code));
    expect(reused).toBeInstanceOf(BadRequestException);
  });
});
