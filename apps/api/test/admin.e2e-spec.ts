import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Admin } from '../src/admins/entities/admin.entity.js';
import { AdminRole } from '@repo/types';

/**
 * Admin accounts against the real Postgres + Redis from docker compose.
 * The system admin is seeded by AppModule on bootstrap and is never deleted.
 */
describe('Admin accounts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const stamp = Date.now();
  const managerUsername = `manager.${stamp}`;
  const agentUsername = `agent.${stamp}`;
  const password = 'secret1234';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.getRepository(Admin).delete({
      username: In([managerUsername, agentUsername]),
    });
    await app.close();
  });

  function sessionCookie(setCookie: string | string[] | undefined): string {
    const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!header) throw new Error('Expected a Set-Cookie header');
    return header.split(';')[0];
  }

  async function login(username: string, pwd = password, rememberMe?: boolean): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ username, password: pwd, ...(rememberMe === undefined ? {} : { rememberMe }) })
      .expect(200);
  }

  it('seeds exactly one system admin with a hashed password', async () => {
    const systemAdmins = await dataSource.getRepository(Admin).find({
      where: { role: AdminRole.SYSTEM },
    });

    expect(systemAdmins).toHaveLength(1);
    expect(systemAdmins[0].username).toBe('admin');
    expect(systemAdmins[0].password).not.toBe('admin');
  });

  it('logs in with the seeded credentials and supports remember me', async () => {
    const short = await login('admin', 'admin');
    const shortCookie = short.headers['set-cookie'] as unknown as string[];
    expect(shortCookie[0]).toMatch(/^admin_session=/);
    expect(shortCookie[0]).toMatch(/HttpOnly/i);
    expect(shortCookie[0]).not.toMatch(/Max-Age=/i);

    const remembered = await login('admin', 'admin', true);
    const rememberedCookie = (remembered.headers['set-cookie'] as unknown as string[])[0];
    expect(rememberedCookie).toMatch(/Max-Age=2592000/i);

    await request(app.getHttpServer())
      .get('/v1/admin/auth/me')
      .set('Cookie', sessionCookie(shortCookie))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ username: 'admin', role: AdminRole.SYSTEM });
        expect(body).not.toHaveProperty('password');
      });

    const bad = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ username: 'admin', password: 'wrong-password' })
      .expect(401);
    expect(bad.body.message).toBe('Invalid username or password');
  });

  it('keeps admin and customer sessions separate', async () => {
    const admin = await login('admin', 'admin');
    const adminCookie = sessionCookie(admin.headers['set-cookie'] as unknown as string[]);

    // The admin cookie cannot authenticate a store route...
    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Cookie', adminCookie)
      .expect(401);

    // ...and a made-up customer cookie cannot authenticate an admin route.
    await request(app.getHttpServer())
      .get('/v1/admin/auth/me')
      .set('Cookie', 'session=not-a-real-session')
      .expect(401);
  });

  it('lets the system admin create managers and agents, but not another system admin', async () => {
    const cookie = sessionCookie((await login('admin', 'admin')).headers['set-cookie'] as unknown as string[]);

    const manager = await request(app.getHttpServer())
      .post('/v1/admin/admins')
      .set('Cookie', cookie)
      .send({ username: managerUsername, password, role: AdminRole.MANAGER })
      .expect(201);
    expect(manager.body).toMatchObject({ username: managerUsername, role: AdminRole.MANAGER });
    expect(manager.body).not.toHaveProperty('password');

    const agent = await request(app.getHttpServer())
      .post('/v1/admin/admins')
      .set('Cookie', cookie)
      .send({ username: agentUsername, password, role: AdminRole.AGENT })
      .expect(201);
    expect(agent.body.role).toBe(AdminRole.AGENT);

    await request(app.getHttpServer())
      .post('/v1/admin/admins')
      .set('Cookie', cookie)
      .send({ username: 'another.system', password, role: AdminRole.SYSTEM })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('role must be manager or agent');
      });

    await request(app.getHttpServer())
      .post('/v1/admin/admins')
      .set('Cookie', cookie)
      .send({ username: managerUsername.toUpperCase(), password, role: AdminRole.AGENT })
      .expect(409)
      .expect(({ body }) => {
        expect(body.message).toBe('This username is already in use.');
      });

    const list = await request(app.getHttpServer())
      .get('/v1/admin/admins')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body.map((admin: { username: string }) => admin.username)).toEqual(
      expect.arrayContaining(['admin', managerUsername, agentUsername]),
    );
  });

  it('denies admin management to managers and refuses to delete the system admin', async () => {
    const systemCookie = sessionCookie((await login('admin', 'admin')).headers['set-cookie'] as unknown as string[]);
    const manager = await dataSource.getRepository(Admin).findOne({
      where: { username: managerUsername },
    });
    expect(manager).not.toBeNull();

    const managerLogin = await login(managerUsername);
    const managerCookie = sessionCookie(managerLogin.headers['set-cookie'] as unknown as string[]);

    await request(app.getHttpServer())
      .get('/v1/admin/admins')
      .set('Cookie', managerCookie)
      .expect(403);

    const systemAdmin = await dataSource.getRepository(Admin).findOne({
      where: { role: AdminRole.SYSTEM },
    });
    await request(app.getHttpServer())
      .delete(`/v1/admin/admins/${systemAdmin!.id}`)
      .set('Cookie', systemCookie)
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe('The system admin cannot be deleted.');
      });
  });

  it('lets an admin change their own password and log out', async () => {
    const loginResponse = await login(managerUsername);
    let cookie = sessionCookie(loginResponse.headers['set-cookie'] as unknown as string[]);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'wrong', newPassword: 'newsecret456' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('Current password is incorrect');
      });

    await request(app.getHttpServer())
      .post('/v1/admin/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: password, newPassword: 'newsecret456' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/logout')
      .set('Cookie', cookie)
      .expect(204);
    await request(app.getHttpServer())
      .get('/v1/admin/auth/me')
      .set('Cookie', cookie)
      .expect(401);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ username: managerUsername, password })
      .expect(401);

    const fresh = await login(managerUsername, 'newsecret456');
    cookie = sessionCookie(fresh.headers['set-cookie'] as unknown as string[]);
    await request(app.getHttpServer())
      .get('/v1/admin/auth/me')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('deletes a non-system admin', async () => {
    const cookie = sessionCookie((await login('admin', 'admin')).headers['set-cookie'] as unknown as string[]);
    const manager = await dataSource.getRepository(Admin).findOne({
      where: { username: managerUsername },
    });

    await request(app.getHttpServer())
      .delete(`/v1/admin/admins/${manager!.id}`)
      .set('Cookie', cookie)
      .expect(204);

    expect(await dataSource.getRepository(Admin).findOne({
      where: { username: managerUsername },
    })).toBeNull();
  });
});
