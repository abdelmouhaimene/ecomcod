import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/auth/mail.service.js';
import { EmailDomainService } from '../src/auth/email-domain.service.js';
import { REDIS_CLIENT } from '../src/redis/redis.module.js';
import { User } from '../src/users/entities/user.entity.js';

/**
 * Full passwordless flow against the real Postgres + Redis from docker compose:
 *   signup -> verify (Set-Cookie) -> /auth/me -> logout -> /auth/me 401
 *
 * Requires `docker compose up -d postgres redis` and the apps/api .env file.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let redis: Redis;
  let dataSource: DataSource;

  const email = `e2e.${Date.now()}@gmail.com`;
  let code = '';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendVerificationCode: async (_email: string, sentCode: string) => {
          code = sentCode;
        },
      })
      // Keep the test hermetic: no real DNS lookups.
      .overrideProvider(EmailDomainService)
      .useValue({ hasValidMailServer: async () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts so cookies and DTO validation behave the same.
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    redis = app.get<Redis>(REDIS_CLIENT);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete({ email });
    await redis.del(`otp:${email}`, `otp:cooldown:${email}`);
    await app.close();
  });

  it('signs up, verifies, authenticates, then logs out', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email })
      .expect(200)
      .expect(({ body }) => {
        expect(body.message).toContain(email);
        expect(body).not.toHaveProperty('code');
      });

    expect(code).toMatch(/^\d{6}$/);

    const verify = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email, code })
      .expect(200);

    expect(verify.body.verified).toBe(true);
    expect(verify.body.user.email).toBe(email);
    expect(verify.body).not.toHaveProperty('token');

    const setCookie = verify.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toHaveLength(1);
    expect(setCookie[0]).toMatch(/^session=[^;]+/);
    expect(setCookie[0]).toMatch(/HttpOnly/i);
    expect(setCookie[0]).toMatch(/SameSite=Lax/i);
    const sessionCookie = setCookie[0].split(';')[0];

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', sessionCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ email, isActive: true });
        expect(body).not.toHaveProperty('password');
      });

    await request(app.getHttpServer()).get('/auth/me').expect(401);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', sessionCookie)
      .expect(204);

    // Revoked server-side: replaying the cookie must not work.
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', sessionCookie)
      .expect(401);
  });

  it('rejects a wrong code and a reused code', async () => {
    const second = `e2e.${Date.now()}.2@gmail.com`;

    await request(app.getHttpServer()).post('/auth/signup').send({ email: second }).expect(200);
    const sentCode = code;

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email: second, code: sentCode === '000000' ? '000001' : '000000' })
      .expect(400);

    const secondVerify = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email: second, code: sentCode })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email: second, code: sentCode })
      .expect(400);

    // verify-email opened a session for `second`; revoke it so Redis stays clean.
    const setCookie = secondVerify.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', setCookie[0].split(';')[0])
      .expect(204);

    await dataSource.getRepository(User).delete({ email: second });
    await redis.del(`otp:${second}`, `otp:cooldown:${second}`);
  });

  it('validates the request body', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'not-an-email' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({})
      .expect(400);
  });
});
