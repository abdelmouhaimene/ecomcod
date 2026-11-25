import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Admin } from '../src/admins/entities/admin.entity.js';
import { FaqItem } from '../src/faq/entities/faq-item.entity.js';
import { PolicyArticle } from '../src/policy/entities/policy-article.entity.js';

/** Admin-managed FAQ and policy content, plus the public storefront feeds. */
describe('FAQ and policy (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    const stamp = Date.now();
    const agentUsername = `content.agent.${stamp}`;
    const password = 'secret1234';
    const faqIds: string[] = [];
    const policyIds: string[] = [];
    let systemCookie: string;
    let agentCookie: string;

    beforeAll(async () => {
        const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = moduleFixture.createNestApplication();
        app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
        app.use(cookieParser());
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
        );
        await app.init();
        dataSource = app.get(DataSource);

        systemCookie = sessionCookie((await request(app.getHttpServer())
            .post('/v1/admin/auth/login')
            .send({ username: 'admin', password: 'admin' })
            .expect(200)).headers['set-cookie']);

        await request(app.getHttpServer())
            .post('/v1/admin/admins')
            .set('Cookie', systemCookie)
            .send({ username: agentUsername, password, role: AdminRole.AGENT })
            .expect(201);
        agentCookie = sessionCookie((await request(app.getHttpServer())
            .post('/v1/admin/auth/login')
            .send({ username: agentUsername, password })
            .expect(200)).headers['set-cookie']);
    });

    afterAll(async () => {
        if (faqIds.length) {
            await dataSource.getRepository(FaqItem).delete({ id: In(faqIds) });
        }
        if (policyIds.length) {
            await dataSource.getRepository(PolicyArticle).delete({ id: In(policyIds) });
        }
        await dataSource.getRepository(Admin).delete({ username: agentUsername });
        await app.close();
    });

    function sessionCookie(header: string | string[] | undefined): string {
        const value = Array.isArray(header) ? header[0] : header;
        if (!value) throw new Error('Expected a Set-Cookie header');
        return value.split(';')[0];
    }

    it('restricts FAQ and policy writes to system/manager admins', async () => {
        await request(app.getHttpServer())
            .post('/v1/admin/faq')
            .set('Cookie', agentCookie)
            .send({ question: 'Agent question?', answer: 'Not allowed.' })
            .expect(403);
        await request(app.getHttpServer())
            .post('/v1/admin/policy')
            .set('Cookie', agentCookie)
            .send({ title: 'Agent article', body: 'Not allowed.' })
            .expect(403);
    });

    it('creates, reorders, hides, exposes and deletes FAQ entries', async () => {
        const first = await request(app.getHttpServer())
            .post('/v1/admin/faq')
            .set('Cookie', systemCookie)
            .send({
                question: `Delivery time? ${stamp}`,
                answer: 'Two to three working days.',
                position: 10,
            })
            .expect(201);
        const second = await request(app.getHttpServer())
            .post('/v1/admin/faq')
            .set('Cookie', systemCookie)
            .send({
                question: `Payment method? ${stamp}`,
                answer: 'Cash on delivery.',
                position: 9,
            })
            .expect(201);
        faqIds.push(first.body.id, second.body.id);

        expect(first.body).toMatchObject({
            question: `Delivery time? ${stamp}`,
            answer: 'Two to three working days.',
            position: 10,
            isActive: true,
        });

        const adminList = await request(app.getHttpServer())
            .get('/v1/admin/faq')
            .set('Cookie', systemCookie)
            .expect(200);
        expect(adminList.body.map((item: { id: string }) => item.id)).toEqual(
            expect.arrayContaining([first.body.id, second.body.id]),
        );

        const hidden = await request(app.getHttpServer())
            .put(`/v1/admin/faq/${first.body.id}`)
            .set('Cookie', systemCookie)
            .send({
                question: `Delivery time? ${stamp}`,
                answer: 'Two to three working days.',
                position: 10,
                isActive: false,
            })
            .expect(200);
        expect(hidden.body.isActive).toBe(false);

        let publicList = await request(app.getHttpServer()).get('/v1/faq').expect(200);
        expect(publicList.body.map((item: { id: string }) => item.id)).not.toContain(first.body.id);
        expect(publicList.body.map((item: { id: string }) => item.id)).toContain(second.body.id);

        await request(app.getHttpServer())
            .put(`/v1/admin/faq/${first.body.id}`)
            .set('Cookie', systemCookie)
            .send({
                question: `Delivery time? ${stamp}`,
                answer: 'Two to three working days.',
                position: 8,
                isActive: true,
            })
            .expect(200);

        publicList = await request(app.getHttpServer()).get('/v1/faq').expect(200);
        const ids: string[] = publicList.body.map((item: { id: string }) => item.id);
        expect(ids.indexOf(first.body.id)).toBeLessThan(ids.indexOf(second.body.id));

        await request(app.getHttpServer())
            .delete(`/v1/admin/faq/${first.body.id}`)
            .set('Cookie', systemCookie)
            .expect(204);
        faqIds.splice(faqIds.indexOf(first.body.id), 1);

        publicList = await request(app.getHttpServer()).get('/v1/faq').expect(200);
        expect(publicList.body.map((item: { id: string }) => item.id)).not.toContain(first.body.id);
    });

    it('creates, updates, exposes and deletes policy articles', async () => {
        const created = await request(app.getHttpServer())
            .post('/v1/admin/policy')
            .set('Cookie', systemCookie)
            .send({
                title: `Returns ${stamp}`,
                body: 'Contact us before sending anything back.',
                position: 3,
            })
            .expect(201);
        policyIds.push(created.body.id);

        expect(created.body).toMatchObject({
            title: `Returns ${stamp}`,
            body: 'Contact us before sending anything back.',
            position: 3,
            isActive: true,
        });

        let publicList = await request(app.getHttpServer()).get('/v1/policy').expect(200);
        expect(publicList.body.map((item: { id: string }) => item.id)).toContain(created.body.id);

        const updated = await request(app.getHttpServer())
            .put(`/v1/admin/policy/${created.body.id}`)
            .set('Cookie', systemCookie)
            .send({
                title: `Updated returns ${stamp}`,
                body: 'Updated policy body.',
                position: 1,
                isActive: false,
            })
            .expect(200);
        expect(updated.body).toMatchObject({
            title: `Updated returns ${stamp}`,
            position: 1,
            isActive: false,
        });

        publicList = await request(app.getHttpServer()).get('/v1/policy').expect(200);
        expect(publicList.body.map((item: { id: string }) => item.id)).not.toContain(created.body.id);

        await request(app.getHttpServer())
            .delete(`/v1/admin/policy/${created.body.id}`)
            .set('Cookie', systemCookie)
            .expect(204);
        policyIds.splice(policyIds.indexOf(created.body.id), 1);
    });

    it('rejects negative positions', async () => {
        await request(app.getHttpServer())
            .post('/v1/admin/faq')
            .set('Cookie', systemCookie)
            .send({ question: 'Bad position?', answer: 'Invalid.', position: -1 })
            .expect(400);
        await request(app.getHttpServer())
            .post('/v1/admin/policy')
            .set('Cookie', systemCookie)
            .send({ title: 'Bad position', body: 'Invalid.', position: -1 })
            .expect(400);
    });
});
