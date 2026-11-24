import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/auth/email/mail.service.js';
import { EmailDomainService } from '../src/auth/email/email-domain.service.js';
import { REDIS_CLIENT } from '../src/redis/redis.module.js';
import { User } from '../src/users/entities/user.entity.js';

/**
 * Email/password flows against the real Postgres + Redis from docker compose:
 *   signup (pending in Redis) -> code -> account in Postgres -> session cookie
 *   login (remember me) | forgot password -> reset code -> new password
 *
 * Requires `docker compose up -d postgres redis` and the apps/api .env file.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let redis: Redis;
  let dataSource: DataSource;

  const stamp = Date.now();
  const email = `e2e.${stamp}@gmail.com`;
  const rememberEmail = `e2e.remember.${stamp}@gmail.com`;
  const resetEmail = `e2e.reset.${stamp}@gmail.com`;
  const googleEmail = `e2e.google.${stamp}@gmail.com`;
  const profileEmail = `e2e.profile.${stamp}@gmail.com`;
  const password = 'secret1234';

  let code = '';
  const sentCodes: string[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendVerificationCode: async (_email: string, sentCode: string) => {
          code = sentCode;
          sentCodes.push(sentCode);
        },
      })
      // Keep the test hermetic: no real DNS lookups.
      .overrideProvider(EmailDomainService)
      .useValue({ hasValidMailServer: async () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts so cookies, versioning and DTO validation behave the same.
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    redis = app.get<Redis>(REDIS_CLIENT);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    for (const address of [email, rememberEmail, resetEmail, googleEmail, profileEmail]) {
      await cleanup(address);
    }
    await app.close();
  });

  async function cleanup(address: string): Promise<void> {
    await dataSource.getRepository(User).delete({ email: address });
    await redis.del(
      `otp:signup:${address}`,
      `otp:cooldown:signup:${address}`,
      `otp:reset:${address}`,
      `otp:cooldown:reset:${address}`,
      `signup:${address}`,
    );
  }

  /** Full signup flow; returns the raw Set-Cookie header. */
  async function signupAndVerify(address: string, pwd = password): Promise<string> {
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email: address, password: pwd })
      .expect(200);

    const verify = await request(app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email: address, code })
      .expect(200);

    const setCookie = verify.headers['set-cookie'] as unknown as string[];
    return setCookie[0];
  }

  function sessionCookie(setCookie: string): string {
    return setCookie.split(';')[0];
  }

  it('signs up with email + password, verifies, authenticates, then logs out', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email, password })
      .expect(200)
      .expect(({ body }) => {
        expect(body.message).toContain(email);
        expect(body).not.toHaveProperty('code');
      });

    // Nothing is written to Postgres until the code is confirmed.
    const pending = await dataSource.getRepository(User).findOne({ where: { email } });
    expect(pending).toBeNull();

    const verify = await request(app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email, code })
      .expect(200);

    expect(verify.body.verified).toBe(true);
    expect(verify.body.user.email).toBe(email);

    const setCookie = verify.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toHaveLength(1);
    expect(setCookie[0]).toMatch(/^session=[^;]+/);
    expect(setCookie[0]).toMatch(/HttpOnly/i);
    expect(setCookie[0]).toMatch(/SameSite=Lax/i);
    expect(setCookie[0]).toMatch(/Max-Age=/i);
    const cookie = sessionCookie(setCookie[0]);

    const created = await dataSource.getRepository(User).findOne({ where: { email } });
    expect(created).not.toBeNull();

    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ email, isActive: true, hasPassword: true });
        expect(body).not.toHaveProperty('password');
      });

    await request(app.getHttpServer()).get('/v1/auth/me').expect(401);

    // Signing up again with an address that already has an account is refused.
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email, password })
      .expect(409)
      .expect(({ body }) => {
        expect(body.message).toBe('This email is already in use. Sign in instead.');
      });

    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    // Revoked server-side: replaying the cookie must not work.
    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('saves the account delivery contact details and exposes them on /me', async () => {
    const cookie = sessionCookie(await signupAndVerify(profileEmail));
    const profile = {
      fullName: 'Amina Benali',
      phoneNumber: '0555 12 34 56',
      wilayaCode: '16',
      wilayaName: 'Alger',
      communeCode: '1601',
      communeName: 'Alger-centre',
    };

    await request(app.getHttpServer())
      .patch('/v1/auth/me')
      .set('Cookie', cookie)
      .send(profile)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          fullName: 'Amina Benali',
          phoneNumber: '0555123456',
          wilayaCode: '16',
          wilayaName: 'Alger',
          communeCode: '1601',
          communeName: 'Alger-centre',
          hasPassword: true,
        });
      });

    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ phoneNumber: '0555123456', communeCode: '1601' });
      });

    await request(app.getHttpServer())
      .patch('/v1/auth/me')
      .set('Cookie', cookie)
      .send({ ...profile, communeCode: '1501' })
      .expect(400);
  });

  it('rejects a wrong code and a reused code', async () => {
    const second = `e2e.${stamp}.code@gmail.com`;

    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email: second, password })
      .expect(200);
    const sentCode = code;

    await request(app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email: second, code: sentCode === '000000' ? '000001' : '000000' })
      .expect(400);

    const secondVerify = await request(app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email: second, code: sentCode })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email: second, code: sentCode })
      .expect(400);

    const cookie = sessionCookie(
      (secondVerify.headers['set-cookie'] as unknown as string[])[0],
    );
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    await cleanup(second);
  });

  it('honours the remember me checkbox when signing in', async () => {
    const cookie = sessionCookie(await signupAndVerify(rememberEmail));
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    const remembered = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: rememberEmail, password, rememberMe: true })
      .expect(200);
    const rememberedCookie = (remembered.headers['set-cookie'] as unknown as string[])[0];
    expect(rememberedCookie).toMatch(/Max-Age=/i);

    const shortLived = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: rememberEmail, password })
      .expect(200);
    const shortCookie = (shortLived.headers['set-cookie'] as unknown as string[])[0];
    expect(shortCookie).not.toMatch(/Max-Age=/i);

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: rememberEmail, password: 'wrong-password' })
      .expect(401);

    for (const raw of [rememberedCookie, shortCookie]) {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Cookie', sessionCookie(raw))
        .expect(204);
    }
  });

  it('resets a forgotten password with an emailed code', async () => {
    const cookie = sessionCookie(await signupAndVerify(resetEmail));
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    const sentBefore = sentCodes.length;
    await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email: resetEmail })
      .expect(200)
      .expect(({ body }) => {
        expect(body.message).toContain('If an account exists');
      });
    expect(sentCodes.length).toBe(sentBefore + 1);

    const reset = await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ email: resetEmail, code, password: 'newsecret456' })
      .expect(200);
    const resetCookie = (reset.headers['set-cookie'] as unknown as string[])[0];
    expect(resetCookie).not.toMatch(/Max-Age=/i);

    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Cookie', sessionCookie(resetCookie))
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: resetEmail, password })
      .expect(401);

    const fresh = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: resetEmail, password: 'newsecret456' })
      .expect(200);

    for (const raw of [resetCookie, (fresh.headers['set-cookie'] as unknown as string[])[0]]) {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Cookie', sessionCookie(raw))
        .expect(204);
    }
  });

  it('never gives a Google-only account a password', async () => {
    await dataSource.getRepository(User).save({
      email: googleEmail,
      googleId: `google-${stamp}`,
      emailVerifiedAt: new Date(),
    });

    // Cannot sign up with the same address: it must use Google sign-in.
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email: googleEmail, password })
      .expect(409);

    // A reset request is accepted but no code is sent (no password to reset).
    const sentBefore = sentCodes.length;
    await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email: googleEmail })
      .expect(200);
    expect(sentCodes.length).toBe(sentBefore);

    // Password login is refused, with a hint to use Google.
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: googleEmail, password })
      .expect(401);
  });

  it('validates the request body', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email: 'not-an-email', password })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email: 'someone@gmail.com' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email: 'someone@gmail.com', password: 'short' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ email: 'someone@gmail.com', code: '12', password })
      .expect(400);
  });
});
