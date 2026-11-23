import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Admin } from '../src/admins/entities/admin.entity.js';
import { GalleryPhoto } from '../src/gallery/entities/gallery-photo.entity.js';
import { GallerySetting } from '../src/gallery/entities/gallery-setting.entity.js';

/** Gallery visibility toggle, admin photo management and public feed. */
describe('Gallery (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    const stamp = Date.now();
    const agentUsername = `gallery.agent.${stamp}`;
    const password = 'secret1234';
    const createdPhotoIds: string[] = [];
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

        const settings = dataSource.getRepository(GallerySetting);
        const setting = await settings.findOneBy({ id: 1 });
        if (setting) {
            setting.isActive = false;
            await settings.save(setting);
        } else {
            await settings.save(settings.create({ id: 1, isActive: false }));
        }
    });

    afterAll(async () => {
        const settings = dataSource.getRepository(GallerySetting);
        const setting = await settings.findOneBy({ id: 1 });
        if (setting) {
            setting.isActive = false;
            await settings.save(setting);
        }
        if (createdPhotoIds.length) {
            await dataSource.getRepository(GalleryPhoto).delete({ id: In(createdPhotoIds) });
        }
        await dataSource.getRepository(Admin).delete({ username: agentUsername });
        await app.close();
    });

    function sessionCookie(header: string | string[] | undefined): string {
        const value = Array.isArray(header) ? header[0] : header;
        if (!value) throw new Error('Expected a Set-Cookie header');
        return value.split(';')[0];
    }

    it('serves the gallery state publicly with the section inactive by default', async () => {
        const response = await request(app.getHttpServer()).get('/v1/gallery').expect(200);
        expect(response.body).toMatchObject({ isActive: false });
        expect(Array.isArray(response.body.photos)).toBe(true);
    });

    it('restricts photo and toggle writes to system/manager admins', async () => {
        const payload = {
            image: '/uploads/gallery.jpg',
            name: 'Atelier bench',
            date: '2026-11-23',
            location: 'Algiers',
        };
        await request(app.getHttpServer())
            .post('/v1/admin/gallery/photos')
            .set('Cookie', agentCookie)
            .send(payload)
            .expect(403);
        await request(app.getHttpServer())
            .put('/v1/admin/gallery/status')
            .set('Cookie', agentCookie)
            .send({ isActive: true })
            .expect(403);
    });

    it('creates, toggles, exposes and deletes a gallery photo', async () => {
        const created = await request(app.getHttpServer())
            .post('/v1/admin/gallery/photos')
            .set('Cookie', systemCookie)
            .send({
                image: '/uploads/gallery.jpg',
                name: 'Atelier bench',
                date: '2026-11-23T09:15:00.000Z',
                location: 'Algiers',
            })
            .expect(201);
        createdPhotoIds.push(created.body.id);
        expect(created.body).toMatchObject({
            image: '/uploads/gallery.jpg',
            name: 'Atelier bench',
            date: '2026-11-23',
            location: 'Algiers',
        });

        const offState = await request(app.getHttpServer())
            .put('/v1/admin/gallery/status')
            .set('Cookie', systemCookie)
            .send({ isActive: false })
            .expect(200);
        expect(offState.body.isActive).toBe(false);

        const onState = await request(app.getHttpServer())
            .put('/v1/admin/gallery/status')
            .set('Cookie', systemCookie)
            .send({ isActive: true })
            .expect(200);
        expect(onState.body.isActive).toBe(true);

        const publicState = await request(app.getHttpServer()).get('/v1/gallery').expect(200);
        expect(publicState.body.isActive).toBe(true);
        expect(publicState.body.photos.map((photo: { id: string }) => photo.id)).toContain(created.body.id);

        await request(app.getHttpServer())
            .delete(`/v1/admin/gallery/photos/${created.body.id}`)
            .set('Cookie', systemCookie)
            .expect(204);
        createdPhotoIds.splice(createdPhotoIds.indexOf(created.body.id), 1);

        const afterDelete = await request(app.getHttpServer()).get('/v1/gallery').expect(200);
        expect(afterDelete.body.photos.map((photo: { id: string }) => photo.id)).not.toContain(created.body.id);
    });
});
