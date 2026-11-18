import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Admin } from '../src/admins/entities/admin.entity.js';
import { Category } from '../src/categories/entities/category.entity.js';
import { Product } from '../src/products/entities/product.entity.js';
import { StockEntryItem } from '../src/stock/entities/stock-entry-item.entity.js';
import { StockEntry } from '../src/stock/entities/stock-entry.entity.js';
import { Supplier } from '../src/stock/entities/supplier.entity.js';

/** Stock entries against the real Postgres + Redis from docker compose. */
describe('Stock module (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;

    const stamp = Date.now();
    const managerUsername = `stock.manager.${stamp}`;
    const agentUsername = `stock.agent.${stamp}`;
    const password = 'secret1234';
    const categoryRef = `stock-cat-${stamp}`;
    const productRef = `stock-sku-${stamp}`;
    const otherProductRef = `stock-sku-two-${stamp}`;
    const supplierName = `Supplier ${stamp}`;
    const otherSupplierName = `Other supplier ${stamp}`;

    let systemCookie: string;
    let managerCookie: string;
    let agentCookie: string;
    let productId: string;
    let otherProductId: string;
    let supplierId: string;
    let otherSupplierId: string;
    let entryId: string;
    let secondEntryId: string;

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

        systemCookie = sessionCookie((await login('admin', 'admin')).headers['set-cookie']);
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
        managerCookie = sessionCookie((await login(managerUsername)).headers['set-cookie']);
        agentCookie = sessionCookie((await login(agentUsername)).headers['set-cookie']);

        const category = await request(app.getHttpServer())
            .post('/v1/admin/categories')
            .set('Cookie', systemCookie)
            .send({ name: `Stock category ${stamp}`, ref: categoryRef })
            .expect(201);

        for (const ref of [productRef, otherProductRef]) {
            const created = await request(app.getHttpServer())
                .post('/v1/admin/products')
                .set('Cookie', systemCookie)
                .send({
                    ref,
                    name: `Product ${ref}`,
                    price: 10,
                    fakeReviews: 0,
                    realReviews: 0,
                    fakeSolds: 0,
                    realSolds: 0,
                    categoryIds: [category.body.id],
                    images: [{ key: 'main', url: `/uploads/${ref}.png`, isMain: true, position: 0 }],
                    variants: [],
                })
                .expect(201);
            if (ref === productRef) productId = created.body.id;
            else otherProductId = created.body.id;
        }

        for (const name of [supplierName, otherSupplierName]) {
            const created = await request(app.getHttpServer())
                .post('/v1/admin/suppliers')
                .set('Cookie', managerCookie)
                .send({ name })
                .expect(201);
            if (name === supplierName) supplierId = created.body.id;
            else otherSupplierId = created.body.id;
        }
    });

    afterAll(async () => {
        const entryIds = [entryId, secondEntryId].filter((id): id is string => Boolean(id));
        if (entryIds.length > 0) {
            await dataSource.getRepository(StockEntryItem).delete({ entryId: In(entryIds) });
            await dataSource.getRepository(StockEntry).delete({ id: In(entryIds) });
        }
        await dataSource.getRepository(Supplier).delete({ id: In([supplierId, otherSupplierId]) });
        await dataSource.getRepository(Product).delete({ ref: In([productRef, otherProductRef]) });
        await dataSource.getRepository(Category).delete({ ref: categoryRef });
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

    function login(username: string, passwordValue = password): Promise<request.Response> {
        return request(app.getHttpServer())
            .post('/v1/admin/auth/login')
            .send({ username, password: passwordValue })
            .expect(200);
    }

    function entryPayload(overrides: Record<string, unknown> = {}): object {
        return {
            date: '2026-01-15',
            supplierId,
            items: [{ productId, quantity: 2, unitPrice: 5.5 }],
            ...overrides,
        };
    }

    it('lets any admin read suppliers and entries but blocks agents from writes', async () => {
        await request(app.getHttpServer())
            .get('/v1/admin/suppliers')
            .set('Cookie', agentCookie)
            .expect(200)
            .expect(({ body }) => expect(body.map((item: { name: string }) => item.name))
                .toEqual(expect.arrayContaining([supplierName])));

        await request(app.getHttpServer())
            .get('/v1/admin/stock-entries')
            .set('Cookie', agentCookie)
            .expect(200);

        await request(app.getHttpServer())
            .post('/v1/admin/stock-entries')
            .set('Cookie', agentCookie)
            .send(entryPayload())
            .expect(403);
        await request(app.getHttpServer())
            .post('/v1/admin/suppliers')
            .set('Cookie', agentCookie)
            .send({ name: 'Forbidden' })
            .expect(403);
    });

    it('validates dates, lines and supplier references', async () => {
        await request(app.getHttpServer())
            .post('/v1/admin/stock-entries')
            .set('Cookie', managerCookie)
            .send(entryPayload({ date: '2026-02-30' }))
            .expect(400);
        await request(app.getHttpServer())
            .post('/v1/admin/stock-entries')
            .set('Cookie', managerCookie)
            .send(entryPayload({ items: [{ productId, quantity: 0, unitPrice: 5 }] }))
            .expect(400);
        await request(app.getHttpServer())
            .post('/v1/admin/stock-entries')
            .set('Cookie', managerCookie)
            .send(entryPayload({ supplierId: '33333333-3333-4333-8333-333333333333' }))
            .expect(404);
    });

    it('creates an entry with computed totals and updates quantity and PMP', async () => {
        const created = await request(app.getHttpServer())
            .post('/v1/admin/stock-entries')
            .set('Cookie', managerCookie)
            .send(entryPayload())
            .expect(201);
        entryId = created.body.id;

        expect(created.body).toMatchObject({
            date: '2026-01-15',
            supplierId,
            supplierName,
            adminUsername: managerUsername,
            total: 11,
            items: [{ productId, quantity: 2, unitPrice: 5.5, lineTotal: 11, productRef }],
        });

        const product = await request(app.getHttpServer())
            .get(`/v1/admin/products/${productId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        expect(product.body).toMatchObject({ quantity: 2, PMP: 5.5 });
    });

    it('applies the weighted average price across entries', async () => {
        const second = await request(app.getHttpServer())
            .post('/v1/admin/stock-entries')
            .set('Cookie', systemCookie)
            .send(entryPayload({
                date: '2026-02-20',
                supplierId: otherSupplierId,
                items: [
                    { productId, quantity: 2, unitPrice: 7.5 },
                    { productId: otherProductId, quantity: 3, unitPrice: 2 },
                ],
            }))
            .expect(201);
        secondEntryId = second.body.id;
        expect(second.body.total).toBe(21);

        const product = await request(app.getHttpServer())
            .get(`/v1/admin/products/${productId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        expect(product.body).toMatchObject({ quantity: 4, PMP: 6.5 });

        const other = await request(app.getHttpServer())
            .get(`/v1/admin/products/${otherProductId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        expect(other.body).toMatchObject({ quantity: 3, PMP: 2 });
    });

    it('filters entries by month, year, product and supplier', async () => {
        const january = await request(app.getHttpServer())
            .get('/v1/admin/stock-entries?month=1&year=2026')
            .set('Cookie', agentCookie)
            .expect(200);
        const januaryIds = january.body.map((entry: { id: string }) => entry.id);
        expect(januaryIds).toContain(entryId);
        expect(januaryIds).not.toContain(secondEntryId);

        const february = await request(app.getHttpServer())
            .get(`/v1/admin/stock-entries?month=2&year=2026&productId=${productId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        const februaryIds = february.body.map((entry: { id: string }) => entry.id);
        expect(februaryIds).toContain(secondEntryId);
        expect(februaryIds).not.toContain(entryId);

        const bySupplier = await request(app.getHttpServer())
            .get(`/v1/admin/stock-entries?supplierId=${supplierId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        const supplierIds = bySupplier.body.map((entry: { id: string }) => entry.id);
        expect(supplierIds).toContain(entryId);
        expect(supplierIds).not.toContain(secondEntryId);

        const byProduct = await request(app.getHttpServer())
            .get(`/v1/admin/stock-entries?productId=${otherProductId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        expect(byProduct.body.map((entry: { id: string }) => entry.id)).toContain(secondEntryId);
    });

    it('keeps suppliers in use and lets only the system admin delete an entry', async () => {
        await request(app.getHttpServer())
            .delete(`/v1/admin/suppliers/${supplierId}`)
            .set('Cookie', systemCookie)
            .expect(409);

        await request(app.getHttpServer())
            .delete(`/v1/admin/stock-entries/${entryId}`)
            .set('Cookie', managerCookie)
            .expect(403);

        await request(app.getHttpServer())
            .delete(`/v1/admin/stock-entries/${entryId}`)
            .set('Cookie', systemCookie)
            .expect(204);
    });

    it('restores quantity and PMP as if the deleted entry never existed', async () => {
        const product = await request(app.getHttpServer())
            .get(`/v1/admin/products/${productId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        expect(product.body).toMatchObject({ quantity: 2, PMP: 7.5 });

        const other = await request(app.getHttpServer())
            .get(`/v1/admin/products/${otherProductId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        expect(other.body).toMatchObject({ quantity: 3, PMP: 2 });

        const remaining = await request(app.getHttpServer())
            .get('/v1/admin/stock-entries')
            .set('Cookie', agentCookie)
            .expect(200);
        const remainingIds = remaining.body.map((entry: { id: string }) => entry.id);
        expect(remainingIds).toContain(secondEntryId);
        expect(remainingIds).not.toContain(entryId);
    });
});
