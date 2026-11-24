import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Admin } from '../src/admins/entities/admin.entity.js';
import { Category } from '../src/categories/entities/category.entity.js';
import { Family } from '../src/families/entities/family.entity.js';
import { Supplier } from '../src/stock/entities/supplier.entity.js';

/** Families, offers, checkout safety and POS against the real Postgres + Redis. */
describe('Commerce (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;

    const stamp = Date.now();
    const managerUsername = `commerce.manager.${stamp}`;
    const agentUsername = `commerce.agent.${stamp}`;
    const password = 'secret1234';
    const categoryRef = `commerce-cat-${stamp}`;
    const productARef = `commerce-a-${stamp}`;
    const productBRef = `commerce-b-${stamp}`;
    const familyRef = `commerce-family-${stamp}`;
    const supplierName = `Commerce supplier ${stamp}`;
    const freeOfferName = `Buy 2 get 1 ${stamp}`;
    const shippingOfferName = `Free shipping ${stamp}`;
    const packOfferName = `Bundle ${stamp}`;

    let systemCookie: string;
    let managerCookie: string;
    let agentCookie: string;
    let categoryId: string;
    let productAId: string;
    let productBId: string;
    let skuAId: string;
    let skuBId: string;
    let supplierId: string;
    let stockEntryId: string;
    let familyId: string;
    let freeOfferId: string;
    let shippingOfferId: string;
    let packOfferId: string;
    let webOrderId: string;
    let posOrderId: string;
    const createdOrderIds: string[] = [];

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
            .send({ name: `Commerce category ${stamp}`, ref: categoryRef })
            .expect(201);
        categoryId = category.body.id;

        for (const [ref, price] of [[productARef, 20], [productBRef, 30]] as const) {
            const created = await request(app.getHttpServer())
                .post('/v1/admin/products')
                .set('Cookie', systemCookie)
                .send({
                    ref,
                    name: `Product ${ref}`,
                    price,
                    fakeReviews: 0,
                    realReviews: 0,
                    fakeSolds: 0,
                    realSolds: 0,
                    categoryIds: [categoryId],
                    images: [{ key: 'main', url: `/uploads/${ref}.png`, isMain: true, position: 0 }],
                    variants: [],
                })
                .expect(201);
            if (ref === productARef) {
                productAId = created.body.id;
                skuAId = created.body.skus[0].id;
            } else {
                productBId = created.body.id;
                skuBId = created.body.skus[0].id;
            }
        }

        const supplier = await request(app.getHttpServer())
            .post('/v1/admin/suppliers')
            .set('Cookie', managerCookie)
            .send({ name: supplierName })
            .expect(201);
        supplierId = supplier.body.id;

        const entry = await request(app.getHttpServer())
            .post('/v1/admin/stock-entries')
            .set('Cookie', managerCookie)
            .send({
                date: '2026-01-15',
                supplierId,
                items: [
                    {
                        productId: productAId,
                        buyingPrice: 5,
                        totalQuantity: 12,
                        combinations: [{ skuId: skuAId, quantity: 12 }],
                    },
                    {
                        productId: productBId,
                        buyingPrice: 8,
                        totalQuantity: 12,
                        combinations: [{ skuId: skuBId, quantity: 12 }],
                    },
                ],
            })
            .expect(201);
        stockEntryId = entry.body.id;
    });

    afterAll(async () => {
        const offerIds = [freeOfferId, shippingOfferId, packOfferId].filter(Boolean);
        const productIds = [productAId, productBId].filter(Boolean);
        const orderIds = [webOrderId, posOrderId, ...createdOrderIds].filter(Boolean);
        if (orderIds.length) {
            await dataSource.query('DELETE FROM "order_items" WHERE "orderId" = ANY($1::uuid[])', [orderIds]);
            await dataSource.query('DELETE FROM "stock_movements" WHERE "orderId" = ANY($1::uuid[])', [orderIds]);
            await dataSource.query('DELETE FROM "orders" WHERE "id" = ANY($1::uuid[])', [orderIds]);
        }
        if (offerIds.length) {
            await dataSource.query('DELETE FROM "offer_single_rules" WHERE "offerId" = ANY($1::uuid[])', [offerIds]);
            await dataSource.query('DELETE FROM "offer_pack_items" WHERE "offerId" = ANY($1::uuid[])', [offerIds]);
            await dataSource.query('DELETE FROM "offers" WHERE "id" = ANY($1::uuid[])', [offerIds]);
        }
        if (stockEntryId) {
            await dataSource.query('DELETE FROM "stock_movements" WHERE "stockEntryId" = $1', [stockEntryId]);
            await dataSource.query(
                'DELETE FROM "stock_entry_combinations" WHERE "entryItemId" IN ' +
                '(SELECT "id" FROM "stock_entry_items" WHERE "entryId" = $1)',
                [stockEntryId],
            );
            await dataSource.query('DELETE FROM "stock_entry_items" WHERE "entryId" = $1', [stockEntryId]);
            await dataSource.query('DELETE FROM "stock_entries" WHERE "id" = $1', [stockEntryId]);
        }
        if (productIds.length) {
            await dataSource.query(
                'DELETE FROM "product_sku_variant_values" WHERE "skuId" IN ' +
                '(SELECT "id" FROM "product_skus" WHERE "productId" = ANY($1::uuid[]))',
                [productIds],
            );
            await dataSource.query('DELETE FROM "product_skus" WHERE "productId" = ANY($1::uuid[])', [productIds]);
            await dataSource.query('DELETE FROM "product_variant_values" WHERE "variantId" IN ' +
                '(SELECT "id" FROM "product_variants" WHERE "productId" = ANY($1::uuid[]))', [productIds]);
            await dataSource.query('DELETE FROM "product_images" WHERE "productId" = ANY($1::uuid[])', [productIds]);
            await dataSource.query('DELETE FROM "product_variants" WHERE "productId" = ANY($1::uuid[])', [productIds]);
            await dataSource.query('DELETE FROM "product_categories" WHERE "productId" = ANY($1::uuid[])', [productIds]);
            await dataSource.query('DELETE FROM "products" WHERE "id" = ANY($1::uuid[])', [productIds]);
        }
        if (familyId) await dataSource.getRepository(Family).delete({ id: familyId });
        if (supplierId) await dataSource.getRepository(Supplier).delete({ id: supplierId });
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

    it('manages product families and links products without touching categories', async () => {
        await request(app.getHttpServer())
            .get('/v1/admin/families')
            .set('Cookie', agentCookie)
            .expect(200);

        await request(app.getHttpServer())
            .post('/v1/admin/families')
            .set('Cookie', agentCookie)
            .send({ name: 'Forbidden', ref: `forbidden-${stamp}` })
            .expect(403);

        const created = await request(app.getHttpServer())
            .post('/v1/admin/families')
            .set('Cookie', managerCookie)
            .send({ name: `  Audio ${stamp}  `, ref: familyRef, description: '  Group  ' })
            .expect(201);
        familyId = created.body.id;
        expect(created.body).toMatchObject({ name: `Audio ${stamp}`, ref: familyRef, description: 'Group' });

        await request(app.getHttpServer())
            .post('/v1/admin/families')
            .set('Cookie', managerCookie)
            .send({ name: `Duplicate ${stamp}`, ref: familyRef })
            .expect(409);

        const updated = await request(app.getHttpServer())
            .put(`/v1/admin/products/${productAId}`)
            .set('Cookie', managerCookie)
            .send({
                ref: productARef,
                name: `Product ${productARef}`,
                price: 20,
                fakeReviews: 0,
                realReviews: 0,
                fakeSolds: 0,
                realSolds: 0,
                categoryIds: [categoryId],
                familyIds: [familyId],
                images: [{ key: 'main', url: `/uploads/${productARef}.png`, isMain: true, position: 0 }],
                variants: [],
            })
            .expect(200);
        expect(updated.body.families.map((family: { id: string }) => family.id)).toEqual([familyId]);

        const publicFamilies = await request(app.getHttpServer())
            .get('/v1/families')
            .expect(200);
        expect(publicFamilies.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: familyId, ref: familyRef }),
        ]));

        // Families are grouping labels only: removal unlinks them from products.
        await request(app.getHttpServer())
            .delete(`/v1/admin/families/${familyId}`)
            .set('Cookie', managerCookie)
            .expect(204);

        const afterDelete = await request(app.getHttpServer())
            .get(`/v1/admin/products/${productAId}`)
            .set('Cookie', managerCookie)
            .expect(200);
        expect(afterDelete.body.families).toEqual([]);

        const publicFamiliesAfter = await request(app.getHttpServer())
            .get('/v1/families')
            .expect(200);
        expect(publicFamiliesAfter.body).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ id: familyId }),
        ]));
    });

    it('manages single-product and pack offers with role guards', async () => {
        const singlePayload = {
            name: freeOfferName,
            type: 'SINGLE_PRODUCT',
            isActive: true,
            singleRule: {
                productId: productAId,
                mode: 'BUY_X_GET_Y_FREE',
                buyQuantity: 2,
                freeQuantity: 1,
            },
            packItems: [],
        };
        await request(app.getHttpServer())
            .post('/v1/admin/offers')
            .set('Cookie', agentCookie)
            .send(singlePayload)
            .expect(403);

        const free = await request(app.getHttpServer())
            .post('/v1/admin/offers')
            .set('Cookie', managerCookie)
            .send(singlePayload)
            .expect(201);
        freeOfferId = free.body.id;
        expect(free.body).toMatchObject({ type: 'SINGLE_PRODUCT', singleRule: {
            productId: productAId, mode: 'BUY_X_GET_Y_FREE', buyQuantity: 2, freeQuantity: 1,
        } });
        expect(free.body.singleRule).not.toHaveProperty('skuId');

        const shipping = await request(app.getHttpServer())
            .post('/v1/admin/offers')
            .set('Cookie', managerCookie)
            .send({
                name: shippingOfferName,
                type: 'SINGLE_PRODUCT',
                isActive: true,
                singleRule: {
                    productId: productBId,
                    mode: 'BUY_X_GET_FREE_SHIPPING',
                    buyQuantity: 1,
                },
            })
            .expect(201);
        shippingOfferId = shipping.body.id;

        const pack = await request(app.getHttpServer())
            .post('/v1/admin/offers')
            .set('Cookie', managerCookie)
            .send({
                name: packOfferName,
                type: 'PACK',
                isActive: true,
                packPrice: 40,
                packItems: [
                    { productId: productAId, quantity: 1 },
                    { productId: productBId, quantity: 1 },
                ],
            })
            .expect(201);
        packOfferId = pack.body.id;

        const active = await request(app.getHttpServer()).get('/v1/offers/active').expect(200);
        const ids = active.body.map((offer: { id: string }) => offer.id);
        expect(ids).toEqual(expect.arrayContaining([freeOfferId, shippingOfferId, packOfferId]));

        const all = await request(app.getHttpServer())
            .get('/v1/admin/offers')
            .set('Cookie', agentCookie)
            .expect(200);
        expect(all.body.map((offer: { id: string }) => offer.id)).toEqual(expect.arrayContaining(ids));

        await request(app.getHttpServer())
            .post('/v1/admin/offers')
            .set('Cookie', managerCookie)
            .send({
                name: `Out of stock ${stamp}`,
                type: 'SINGLE_PRODUCT',
                isActive: true,
                singleRule: {
                    productId: productAId,
                    mode: 'BUY_X_GET_Y_FREE',
                    buyQuantity: 2,
                    freeQuantity: 1,
                },
            })
            .expect(201)
            .then((response) => request(app.getHttpServer())
                .delete(`/v1/admin/offers/${response.body.id}`)
                .set('Cookie', managerCookie)
                .expect(204));
    });

    it('hides manually inactive and out-of-time offers from the active feed', async () => {
        const createOffer = async (name: string, payload: Record<string, unknown>) => {
            const response = await request(app.getHttpServer())
                .post('/v1/admin/offers')
                .set('Cookie', managerCookie)
                .send({ name, type: 'SINGLE_PRODUCT', ...payload })
                .expect(201);
            return response.body.id as string;
        };
        const buyGetRule = {
            productId: productAId,
            mode: 'BUY_X_GET_Y_FREE',
            buyQuantity: 2,
            freeQuantity: 1,
        };

        const inactiveId = await createOffer(`Inactive ${stamp}`, {
            isActive: false,
            singleRule: buyGetRule,
        });
        const futureId = await createOffer(`Future ${stamp}`, {
            isActive: true,
            startsAt: new Date(Date.now() + 86_400_000).toISOString(),
            singleRule: buyGetRule,
        });
        const expiredId = await createOffer(`Expired ${stamp}`, {
            isActive: true,
            endsAt: new Date(Date.now() - 86_400_000).toISOString(),
            singleRule: buyGetRule,
        });
        const shippingId = await createOffer(`Shipping ${stamp}`, {
            isActive: true,
            singleRule: {
                productId: productBId,
                mode: 'BUY_X_GET_FREE_SHIPPING',
                buyQuantity: 1,
            },
        });

        try {
            const active = await request(app.getHttpServer()).get('/v1/offers/active').expect(200);
            const ids = active.body.map((offer: { id: string }) => offer.id);
            expect(ids).not.toContain(inactiveId);
            expect(ids).not.toContain(futureId);
            expect(ids).not.toContain(expiredId);
            expect(active.body.find((offer: { id: string }) => offer.id === shippingId))
                .toMatchObject({ freeShipping: true });
        } finally {
            for (const id of [inactiveId, futureId, expiredId, shippingId]) {
                await request(app.getHttpServer())
                    .delete(`/v1/admin/offers/${id}`)
                    .set('Cookie', managerCookie)
                    .expect(204);
            }
        }
    });

    it('serves paginated public products with SKUs and no variant price', async () => {
        const response = await request(app.getHttpServer()).get('/v1/products').expect(200);
        expect(response.body).toMatchObject({
            page: 1,
            limit: 9,
            total: expect.any(Number),
            totalPages: expect.any(Number),
        });
        const product = response.body.items.find((item: { id: string }) => item.id === productAId);
        expect(product).toBeTruthy();
        expect(product.skus[0]).toMatchObject({ productId: productAId, stockQuantity: 12 });
        expect(product.skus[0]).not.toHaveProperty('price');

        await request(app.getHttpServer()).get(`/v1/products/${productAId}`).expect(200);
    });

    it('paginates, searches and filters public products through query strings', async () => {
        const first = await request(app.getHttpServer())
            .get('/v1/products?page=1&limit=1')
            .expect(200);
        expect(first.body.items).toHaveLength(1);
        expect(first.body).toMatchObject({ page: 1, limit: 1, totalPages: first.body.total });

        const second = await request(app.getHttpServer())
            .get('/v1/products?page=2&limit=1')
            .expect(200);
        expect(second.body.page).toBe(2);
        expect(second.body.items[0]?.id).not.toBe(first.body.items[0]?.id);

        const filtered = await request(app.getHttpServer())
            .get(`/v1/products?categoryId=${categoryId}&limit=9`)
            .expect(200);
        expect(filtered.body.items.length).toBeGreaterThan(0);
        expect(filtered.body.items.every((item: { categories: { id: string }[] }) =>
            item.categories.some((category) => category.id === categoryId))).toBe(true);

        const searched = await request(app.getHttpServer())
            .get(`/v1/products?q=${encodeURIComponent(productARef)}`)
            .expect(200);
        expect(searched.body.items.some((item: { id: string }) => item.id === productAId)).toBe(true);

        await request(app.getHttpServer()).get('/v1/products?page=0').expect(400);
    });

    it('serves public categories with their optional icon', async () => {
        const categories = await request(app.getHttpServer()).get('/v1/categories').expect(200);
        const category = categories.body.find((item: { id: string }) => item.id === categoryId);
        expect(category).toMatchObject({ id: categoryId, icon: null });
    });

    it('checks out regular items from the product price and deducts stock', async () => {
        const order = await request(app.getHttpServer())
            .post('/v1/orders')
            .send({
                source: 'POS',
                items: [{ skuId: skuAId, quantity: 1 }],
                baseShippingCost: 5,
                taxAmount: 1,
            })
            .expect(201);
        webOrderId = order.body.id;
        createdOrderIds.push(webOrderId);

        expect(order.body).toMatchObject({
            source: 'WEB',
            status: 'COMPLETED',
            subtotal: 20,
            discount: 0,
            shippingCost: 5,
            taxAmount: 1,
            total: 26,
            freeShipping: false,
        });
        expect(order.body.orderNumber).toMatch(/^ORD-/);
        expect(order.body.items).toMatchObject([
            { skuId: skuAId, quantity: 1, unitPrice: 20, lineTotal: 20, kind: 'REGULAR' },
        ]);

        const fetched = await request(app.getHttpServer())
            .get(`/v1/orders/${webOrderId}`)
            .expect(200);
        expect(fetched.body.orderNumber).toBe(order.body.orderNumber);

        const availability = await request(app.getHttpServer())
            .get('/v1/admin/stock/availability')
            .set('Cookie', agentCookie)
            .expect(200);
        expect(availability.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ skuId: skuAId, stockQuantity: 11 }),
        ]));
    });

    it('allocates free units for BUY_X_GET_Y_FREE including their stock', async () => {
        const order = await request(app.getHttpServer())
            .post('/v1/orders')
            .send({
                source: 'WEB',
                items: [{ skuId: skuAId, quantity: 2 }],
                offers: [{
                    offerId: freeOfferId,
                    times: 1,
                    selections: [{ productId: productAId, skuId: skuAId }],
                }],
            })
            .expect(201);
        createdOrderIds.push(order.body.id);

        expect(order.body).toMatchObject({ subtotal: 40, discount: 20, total: 20 });
        expect(order.body.items.map((item: { kind: string }) => item.kind)).toEqual(
            expect.arrayContaining(['REGULAR', 'SINGLE_FREE']),
        );

        const availability = await request(app.getHttpServer())
            .get('/v1/admin/stock/availability')
            .set('Cookie', agentCookie)
            .expect(200);
        expect(availability.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ skuId: skuAId, stockQuantity: 8 }),
        ]));
    });

    it('rejects an applied offer without a variant selection', async () => {
        await request(app.getHttpServer())
            .post('/v1/orders')
            .send({
                source: 'WEB',
                items: [{ skuId: skuAId, quantity: 2 }],
                offers: [{ offerId: freeOfferId, times: 1 }],
            })
            .expect(400);
    });

    it('makes shipping free without changing product prices', async () => {
        const order = await request(app.getHttpServer())
            .post('/v1/orders')
            .send({
                source: 'WEB',
                items: [{ skuId: skuBId, quantity: 1 }],
                offers: [{
                    offerId: shippingOfferId,
                    times: 1,
                    selections: [{ productId: productBId, skuId: skuBId }],
                }],
                baseShippingCost: 7,
            })
            .expect(201);
        createdOrderIds.push(order.body.id);

        expect(order.body).toMatchObject({
            subtotal: 30, discount: 0, shippingCost: 0, total: 30, freeShipping: true,
        });
        expect(order.body.items[0].unitPrice).toBe(30);
    });

    it('applies a pack fixed price and deducts every required SKU', async () => {
        const order = await request(app.getHttpServer())
            .post('/v1/orders')
            .send({
                source: 'WEB',
                items: [],
                offers: [{
                    offerId: packOfferId,
                    times: 1,
                    selections: [
                        { productId: productAId, skuId: skuAId },
                        { productId: productBId, skuId: skuBId },
                    ],
                }],
            })
            .expect(201);
        createdOrderIds.push(order.body.id);

        expect(order.body).toMatchObject({ subtotal: 50, discount: 10, total: 40 });
        expect(order.body.items.map((item: { skuId: string; kind: string }) => item.kind))
            .toEqual(['PACK', 'PACK']);

        const availability = await request(app.getHttpServer())
            .get('/v1/admin/stock/availability')
            .set('Cookie', agentCookie)
            .expect(200);
        const bySku = new Map(
            availability.body.map((sku: { skuId: string; stockQuantity: number }) =>
                [sku.skuId, sku.stockQuantity]),
        );
        expect(bySku.get(skuAId)).toBe(7);
        expect(bySku.get(skuBId)).toBe(10);
    });

    it('rejects an order whose total required SKU quantity exceeds stock', async () => {
        await request(app.getHttpServer())
            .post('/v1/orders')
            .send({
                source: 'WEB',
                items: [{ skuId: skuAId, quantity: 1000 }],
            })
            .expect(400);

        const availability = await request(app.getHttpServer())
            .get('/v1/admin/stock/availability')
            .set('Cookie', agentCookie)
            .expect(200);
        expect(availability.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ skuId: skuAId, stockQuantity: 7 }),
        ]));
    });

    it('restricts POS writes to managers and records the POS source', async () => {
        await request(app.getHttpServer())
            .get('/v1/admin/pos/orders')
            .set('Cookie', agentCookie)
            .expect(200);

        await request(app.getHttpServer())
            .post('/v1/admin/pos/orders')
            .set('Cookie', agentCookie)
            .send({ source: 'WEB', items: [{ skuId: skuAId, quantity: 1 }] })
            .expect(403);

        const order = await request(app.getHttpServer())
            .post('/v1/admin/pos/orders')
            .set('Cookie', managerCookie)
            .send({ source: 'WEB', items: [{ skuId: skuAId, quantity: 1 }] })
            .expect(201);
        posOrderId = order.body.id;
        createdOrderIds.push(posOrderId);
        expect(order.body.source).toBe('POS');

        const fetched = await request(app.getHttpServer())
            .get(`/v1/admin/pos/orders/${posOrderId}`)
            .set('Cookie', agentCookie)
            .expect(200);
        expect(fetched.body.orderNumber).toBe(order.body.orderNumber);
    });
});
