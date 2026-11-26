import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Admin } from '../src/admins/entities/admin.entity.js';
import { StorePhone } from '../src/store/entities/store-phone.entity.js';
import { StoreSetting } from '../src/store/entities/store-setting.entity.js';
import { StoreSocialLink } from '../src/store/entities/store-social-link.entity.js';

/** Store settings, contact lists and the public storefront contract. */
describe('Store (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    const stamp = Date.now();
    const agentUsername = `store.agent.${stamp}`;
    const password = 'secret1234';
    let systemCookie: string;
    let agentCookie: string;

    const defaults = {
        name: 'AURELIA TECH',
        description: 'Precision hardware and high-grade accessories for discerning workspaces.',
        logo: '',
        email: 'support@aurumtech.luxury',
        website: '',
        address: '',
        mapQuery: '',
        homeVideoEnabled: false,
        homeVideoUrl: '',
        phones: [],
        socialLinks: [],
    };

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

        await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', systemCookie)
            .send(defaults)
            .expect(200);
    });

    afterAll(async () => {
        await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', systemCookie)
            .send(defaults)
            .expect(200);
        await dataSource.getRepository(Admin).delete({ username: agentUsername });
        await app.close();
    });

    function sessionCookie(header: string | string[] | undefined): string {
        const value = Array.isArray(header) ? header[0] : header;
        if (!value) throw new Error('Expected a Set-Cookie header');
        return value.split(';')[0];
    }

    it('serves the seeded store details publicly', async () => {
        const response = await request(app.getHttpServer()).get('/v1/store').expect(200);
        expect(response.body).toMatchObject({
            name: 'AURELIA TECH',
            mapLink: '',
            mapEmbedUrl: '',
            homeVideoEnabled: false,
            homeVideoUrl: '',
            homeVideoEmbedUrl: '',
            phones: [],
            socialLinks: [],
        });
    });

    it('restricts store edits to system/manager admins', async () => {
        await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', agentCookie)
            .send(defaults)
            .expect(403);
    });

    it('validates contact fields and social platforms', async () => {
        await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', systemCookie)
            .send({ ...defaults, email: 'not-an-email' })
            .expect(400);
        await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', systemCookie)
            .send({
                ...defaults,
                socialLinks: [{ platform: 'myspace', url: 'https://myspace.com/x' }],
            })
            .expect(400);
    });

    it('persists and validates the optional home video link', async () => {
        const homeVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12';
        const updated = await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', systemCookie)
            .send({ ...defaults, homeVideoEnabled: true, homeVideoUrl })
            .expect(200);

        expect(updated.body).toMatchObject({
            homeVideoEnabled: true,
            homeVideoUrl,
            homeVideoEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        });

        await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', systemCookie)
            .send({ ...defaults, homeVideoEnabled: true, homeVideoUrl: 'https://example.com/video' })
            .expect(400);
    });

    it('rejects configuring the same social network twice', async () => {
        await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', systemCookie)
            .send({
                ...defaults,
                socialLinks: [
                    { platform: 'facebook', url: 'https://facebook.com/a' },
                    { platform: 'facebook', url: 'https://facebook.com/b' },
                ],
            })
            .expect(400);
    });

    it('persists the whole store configuration and exposes derived map URLs', async () => {
        const payload = {
            name: 'Aurelia Tech',
            description: 'Precision hardware for every desk.',
            logo: '/uploads/logo.png',
            email: 'hello@aurelia.dz',
            website: 'https://aurelia.dz',
            address: '540 Madison Ave, New York',
            mapQuery: 'https://www.google.com/maps/place/Grand+Central+Terminal/@40.7527,-73.9772,17z',
            phones: ['+1 800 450', '+213 555 000 002'],
            socialLinks: [
                { platform: 'instagram', url: 'https://instagram.com/aurelia' },
                { platform: 'ouedkniss', url: 'https://www.ouedkniss.com/aurelia' },
            ],
        };

        const updated = await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', systemCookie)
            .send(payload)
            .expect(200);
        expect(updated.body).toMatchObject({
            name: 'Aurelia Tech',
            logo: '/uploads/logo.png',
            email: 'hello@aurelia.dz',
            phones: [
                expect.objectContaining({ number: '+1 800 450', position: 0 }),
                expect.objectContaining({ number: '+213 555 000 002', position: 1 }),
            ],
        });
        expect(updated.body.socialLinks.map((link: { platform: string }) => link.platform).sort()).toEqual([
            'instagram',
            'ouedkniss',
        ]);
        expect(updated.body.mapLink).toBe(payload.mapQuery);
        expect(updated.body.mapEmbedUrl).toContain('q=40.7527%2C-73.9772');

        const publicInfo = await request(app.getHttpServer()).get('/v1/store').expect(200);
        expect(publicInfo.body).toEqual(updated.body);

        expect(await dataSource.getRepository(StorePhone).count()).toBe(2);
        expect(await dataSource.getRepository(StoreSocialLink).count()).toBe(2);

        // Replacement removes the previous list rows instead of appending.
        await request(app.getHttpServer())
            .put('/v1/admin/store')
            .set('Cookie', systemCookie)
            .send({ ...defaults, phones: ['+213 555 111 111'] })
            .expect(200);
        expect(await dataSource.getRepository(StorePhone).count()).toBe(1);
        expect(await dataSource.getRepository(StoreSocialLink).count()).toBe(0);
        expect(await dataSource.getRepository(StoreSetting).count()).toBe(1);
    });
});
