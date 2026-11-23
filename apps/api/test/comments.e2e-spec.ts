import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Admin } from '../src/admins/entities/admin.entity.js';
import { EmailDomainService } from '../src/auth/email/email-domain.service.js';
import { MailService } from '../src/auth/email/mail.service.js';
import { SESSION_COOKIE } from '../src/auth/shared/session.service.js';
import { SessionService } from '../src/auth/shared/session.service.js';
import { Comment } from '../src/comments/entities/comment.entity.js';
import { User } from '../src/users/entities/user.entity.js';

/** Verified-only posting, admin fake comments and public carousel feed. */
describe('Comments (e2e)', () => {
    let app: INestApplication;
    let sessions: SessionService;
    const stamp = Date.now();
    const verifiedEmail = `comments.verified.${stamp}@gmail.com`;
    const unverifiedEmail = `comments.unverified.${stamp}@gmail.com`;
    const managerUsername = `comments.manager.${stamp}`;
    const agentUsername = `comments.agent.${stamp}`;
    const password = 'secret1234';
    let code = '';
    let systemCookie: string;
    let managerCookie: string;
    let agentCookie: string;
    let verifiedCookie: string;
    let unverifiedCookie: string;
    let verifiedUserId: string;
    let unverifiedUserId: string;
    const commentIds: string[] = [];

    beforeAll(async () => {
        const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(MailService)
            .useValue({
                sendVerificationCode: async (_email: string, sentCode: string) => {
                    code = sentCode;
                },
            })
            .overrideProvider(EmailDomainService)
            .useValue({ hasValidMailServer: async () => true })
            .compile();

        app = moduleFixture.createNestApplication();
        app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
        app.use(cookieParser());
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
        );
        await app.init();
        sessions = app.get(SessionService);

        systemCookie = sessionCookie((await adminLogin('admin', 'admin')).headers['set-cookie']);
        for (const [username, role] of [
            [managerUsername, AdminRole.MANAGER],
            [agentUsername, AdminRole.AGENT],
        ] as const) {
            await request(app.getHttpServer())
                .post('/v1/admin/admins')
                .set('Cookie', systemCookie)
                .send({ username, password, role })
                .expect(201);
        }
        managerCookie = sessionCookie((await adminLogin(managerUsername)).headers['set-cookie']);
        agentCookie = sessionCookie((await adminLogin(agentUsername)).headers['set-cookie']);

        await request(app.getHttpServer())
            .post('/v1/auth/signup')
            .send({ email: verifiedEmail, password })
            .expect(200);
        const verified = await request(app.getHttpServer())
            .post('/v1/auth/verify-email')
            .send({ email: verifiedEmail, code })
            .expect(200);
        verifiedCookie = sessionCookie(verified.headers['set-cookie']);
        const dataSource = app.get(DataSource);
        const verifiedUser = await dataSource
            .getRepository(User)
            .findOneOrFail({ where: { email: verifiedEmail } });
        verifiedUserId = verifiedUser.id;
        await dataSource.getRepository(User).update({ id: verifiedUserId }, { fullName: 'Ada Collector' });

        const unverified = await dataSource.getRepository(User).save(
            dataSource.getRepository(User).create({
                email: unverifiedEmail,
                fullName: 'Unverified Collector',
                emailVerifiedAt: null,
                isActive: true,
            }),
        );
        unverifiedUserId = unverified.id;
        const session = await sessions.create(unverifiedUserId);
        unverifiedCookie = `${SESSION_COOKIE}=${session.token}`;
    });

    afterAll(async () => {
        const dataSource = app.get(DataSource);
        if (commentIds.length) {
            await dataSource.getRepository(Comment).delete({ id: In(commentIds) });
        }
        await dataSource.getRepository(User).delete({ id: In([verifiedUserId, unverifiedUserId].filter(Boolean)) });
        await dataSource.getRepository(Admin).delete({
            username: In([managerUsername, agentUsername]),
        });
        await app.close();
    });

    function sessionCookie(header: string | string[] | undefined): string {
        const value = Array.isArray(header) ? header[0] : header;
        if (!value) throw new Error('Expected a Set-Cookie header');
        return value.split(';')[0];
    }

    function adminLogin(username: string, passwordValue = password): Promise<request.Response> {
        return request(app.getHttpServer())
            .post('/v1/admin/auth/login')
            .send({ username, password: passwordValue })
            .expect(200);
    }

    it('lets only verified users post comments and snapshots their account name', async () => {
        const created = await request(app.getHttpServer())
            .post('/v1/comments')
            .set('Cookie', verifiedCookie)
            .send({ content: '  Stellar acoustic clarity.  ', rating: 5 })
            .expect(201);
        commentIds.push(created.body.id);
        expect(created.body).toMatchObject({
            username: 'Ada Collector',
            content: 'Stellar acoustic clarity.',
            rating: 5,
            source: 'USER',
        });

        await request(app.getHttpServer())
            .post('/v1/comments')
            .set('Cookie', unverifiedCookie)
            .send({ content: 'I have not verified my email', rating: 4 })
            .expect(403);
        await request(app.getHttpServer())
            .post('/v1/comments')
            .send({ content: 'Anonymous visitor', rating: 4 })
            .expect(401);
        await request(app.getHttpServer())
            .post('/v1/comments')
            .set('Cookie', verifiedCookie)
            .send({ content: 'Too short', rating: 0 })
            .expect(400);
    });

    it('lets managers create and delete fake comments visible in the public feed', async () => {
        const payload = {
            username: 'Julian Vance',
            userImage: '/uploads/julian.png',
            content: 'A masterclass in modern physical computing.',
            rating: 4,
        };
        await request(app.getHttpServer())
            .post('/v1/admin/comments')
            .set('Cookie', agentCookie)
            .send(payload)
            .expect(403);

        const created = await request(app.getHttpServer())
            .post('/v1/admin/comments')
            .set('Cookie', managerCookie)
            .send(payload)
            .expect(201);
        commentIds.push(created.body.id);
        expect(created.body).toMatchObject({ ...payload, source: 'ADMIN' });

        const feed = await request(app.getHttpServer()).get('/v1/comments').expect(200);
        expect(feed.body.map((item: { id: string }) => item.id)).toContain(created.body.id);

        await request(app.getHttpServer())
            .delete(`/v1/admin/comments/${created.body.id}`)
            .set('Cookie', agentCookie)
            .expect(403);
        await request(app.getHttpServer())
            .delete(`/v1/admin/comments/${created.body.id}`)
            .set('Cookie', managerCookie)
            .expect(204);
        commentIds.splice(commentIds.indexOf(created.body.id), 1);

        const afterDelete = await request(app.getHttpServer()).get('/v1/comments').expect(200);
        expect(afterDelete.body.map((item: { id: string }) => item.id)).not.toContain(created.body.id);
    });
});
