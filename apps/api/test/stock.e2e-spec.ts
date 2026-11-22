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
    let categoryId: string;
    let productId: string;
    let otherProductId: string;
    let skuId: string;
    let secondSkuId: string;
    let otherSkuId: string;
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
        categoryId = category.body.id;

        for (const ref of [productRef, otherProductRef]) {
            const variants = ref === productRef
                ? [{
                    name: 'Color', variantType: 'COLOR',
                    values: [
                        { value: 'Black', hexColor: '#000000', imageKey: 'main' },
                        { value: 'White', hexColor: '#ffffff', imageKey: 'main' },
                    ],
                }]
                : [];
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
                    categoryIds: [categoryId],
                    images: [{ key: 'main', url: `/uploads/${ref}.png`, isMain: true, position: 0 }],
                    variants,
                })
                .expect(201);
            if (ref === productRef) {
                productId = created.body.id;
                skuId = created.body.skus.find((sku: { label: string }) => sku.label === 'Black').id;
                secondSkuId = created.body.skus.find((sku: { label: string }) => sku.label === 'White').id;
            } else {
                otherProductId = created.body.id;
                otherSkuId = created.body.skus[0].id;
            }
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
            await dataSource.query(
                'DELETE FROM "stock_movements" WHERE "stockEntryId" = ANY($1::uuid[])',
                [entryIds],
            );
            await dataSource.query(
                'DELETE FROM "stock_entry_combinations" WHERE "entryItemId" IN ' +
                '(SELECT "id" FROM "stock_entry_items" WHERE "entryId" = ANY($1::uuid[]))',
                [entryIds],
            );
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

    function message(body: unknown): string {
        const raw = (body as { message?: unknown }).message;
        return Array.isArray(raw) ? raw.join(' ') : String(raw);
    }

    function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            productId,
            buyingPrice: 5.5,
            totalQuantity: 2,
            combinations: [{ skuId, quantity: 2 }, { skuId: secondSkuId, quantity: 0 }],
            ...overrides,
        };
    }

    function entryPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            date: '2026-01-15',
            supplierId,
            items: [item()],
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

    it('validates dates, product lines, prices and combination sums', async () => {
        const cases: Array<[string, Record<string, unknown>, number, string?]> = [
            ['invalid date', entryPayload({ date: '2026-02-30' }), 400],
            ['negative price', entryPayload({
                items: [item({ buyingPrice: -1 })],
            }), 400],
            ['too many price decimals', entryPayload({
                items: [item({ buyingPrice: 1.234 })],
            }), 400],
            ['zero total quantity', entryPayload({
                items: [item({ totalQuantity: 0 })],
            }), 400],
            ['missing active combination', entryPayload({
                items: [item({
                    combinations: [{ skuId, quantity: 2 }],
                })],
            }), 400, 'All active combinations of a product must be listed.'],
            ['short distribution', entryPayload({
                items: [item({ combinations: [{ skuId, quantity: 1 }, { skuId: secondSkuId, quantity: 0 }] })],
            }), 400, 'Combination quantities (1) are less than totalQuantity (2).'],
            ['over distribution', entryPayload({
                items: [item({ totalQuantity: 1 })],
            }), 400, 'Combination quantities (2) are greater than totalQuantity (1).'],
            ['unknown supplier', entryPayload({
                supplierId: '33333333-3333-4333-8333-333333333333',
            }), 404],
        ];

        for (const [label, payloadValue, status, expected] of cases) {
            const response = await request(app.getHttpServer())
                .post('/v1/admin/stock-entries')
                .set('Cookie', managerCookie)
                .send(payloadValue)
                .expect(status);
            if (expected) expect(message(response.body), label).toContain(expected);
        }
    });

    it('creates an entry with computed totals, combination lines and updated quantity and PMP', async () => {
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
            items: [{
                productId,
                productRef,
                buyingPrice: 5.5,
                totalQuantity: 2,
                lineTotal: 11,
            }],
        });
        expect(created.body.items[0].combinations).toHaveLength(2);
        expect(created.body.items[0].combinations).toEqual(expect.arrayContaining([
            expect.objectContaining({ skuId, quantity: 2 }),
            expect.objectContaining({ skuId: secondSkuId, quantity: 0 }),
        ]));
        for (const combination of created.body.items[0].combinations) {
            expect(combination.sku).toBeTruthy();
            expect(combination.skuLabel).toBeTruthy();
        }

        const product = await request(app.getHttpServer())
            .get(`/v1/admin/products/${productId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        expect(product.body).toMatchObject({ quantity: 2, PMP: 5.5 });
        expect(product.body.skus.find((sku: { id: string }) => sku.id === skuId))
            .toMatchObject({ stockQuantity: 2, PMP: 5.5 });
        expect(product.body.skus.find((sku: { id: string }) => sku.id === secondSkuId))
            .toMatchObject({ stockQuantity: 0, PMP: 0 });
    });

    it('exposes per-SKU availability and filters entries by SKU', async () => {
        const availability = await request(app.getHttpServer())
            .get('/v1/admin/stock/availability')
            .set('Cookie', agentCookie)
            .expect(200);
        expect(availability.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ skuId, productId, productRef, stockQuantity: 2 }),
            expect.objectContaining({ skuId: secondSkuId, productId, productRef, stockQuantity: 0 }),
        ]));

        for (const id of [skuId, secondSkuId]) {
            const bySku = await request(app.getHttpServer())
                .get(`/v1/admin/stock-entries?skuId=${id}`)
                .set('Cookie', agentCookie)
                .expect(200);
            expect(bySku.body.map((entry: { id: string }) => entry.id)).toContain(entryId);
        }
    });

    it('applies the weighted average price across entries', async () => {
        const second = await request(app.getHttpServer())
            .post('/v1/admin/stock-entries')
            .set('Cookie', systemCookie)
            .send({
                date: '2026-02-20',
                supplierId: otherSupplierId,
                items: [
                    {
                        productId, buyingPrice: 7.5, totalQuantity: 2,
                        combinations: [{ skuId, quantity: 1 }, { skuId: secondSkuId, quantity: 1 }],
                    },
                    {
                        productId: otherProductId, buyingPrice: 2, totalQuantity: 3,
                        combinations: [{ skuId: otherSkuId, quantity: 3 }],
                    },
                ],
            })
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
        expect(product.body.skus.find((sku: { id: string }) => sku.id === skuId))
            .toMatchObject({ stockQuantity: 1, PMP: 7.5 });
        expect(product.body.skus.find((sku: { id: string }) => sku.id === secondSkuId))
            .toMatchObject({ stockQuantity: 1, PMP: 7.5 });

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
