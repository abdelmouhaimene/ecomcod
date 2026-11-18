import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import cookieParser from 'cookie-parser';
import express from 'express';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { Admin } from '../src/admins/entities/admin.entity.js';
import { Category } from '../src/categories/entities/category.entity.js';
import { Product } from '../src/products/entities/product.entity.js';
import { AppModule } from '../src/app.module.js';

/** Catalog CRUD against the real Postgres + Redis from docker compose. */
describe('Products catalog (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const stamp = Date.now();
  const managerUsername = `catalog.manager.${stamp}`;
  const agentUsername = `catalog.agent.${stamp}`;
  const password = 'secret1234';
  const categoryName = `Audio ${stamp}`;
  const categoryRef = `audio-${stamp}`;
  const otherCategoryName = `Video ${stamp}`;
  const otherCategoryRef = `video-${stamp}`;
  const spareCategoryName = `Spare ${stamp}`;
  const spareCategoryRef = `spare-${stamp}`;
  const productRef = `sku-${stamp}`;
  const secondProductRef = `sku-two-${stamp}`;

  let systemCookie: string;
  let managerCookie: string;
  let agentCookie: string;
  let categoryId: string;
  let otherCategoryId: string;
  let spareCategoryId: string;
  let productId: string;
  let mainImageId: string;
  let variantId: string;
  const uploadedFiles: string[] = [];

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  );

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use(cookieParser());
    app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);

    const loginResponse = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ username: 'admin', password: 'admin' })
      .expect(200);
    systemCookie = sessionCookie(loginResponse.headers['set-cookie']);

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
  });

  afterAll(async () => {
    await dataSource.getRepository(Product).delete({ ref: In([productRef, secondProductRef]) });
    await dataSource.getRepository(Category).delete({
      ref: In([categoryRef, otherCategoryRef, spareCategoryRef]),
    });
    await dataSource.getRepository(Admin).delete({
      username: In([managerUsername, agentUsername]),
    });
    await Promise.all(uploadedFiles.map((file) => unlink(file).catch(() => undefined)));
    await app.close();
  });

  function sessionCookie(header: string | string[] | undefined): string {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) throw new Error('Expected a Set-Cookie header');
    return value.split(';')[0];
  }

  function login(username: string): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ username, password })
      .expect(200);
  }

  function message(body: unknown): string {
    const raw = (body as { message?: unknown }).message;
    return Array.isArray(raw) ? raw.join(' ') : String(raw);
  }

  function categoryPayload(name: string, ref: string): object {
    return { name, ref };
  }

  function productPayload(ref: string, overrides: Record<string, unknown> = {}): object {
    return {
      ref,
      name: `Product ${ref}`,
      subtitle: ' A subtitle ',
      description: 'A description',
      price: 19.99,
      oldPrice: 24.99,
      fakeReviews: 4.5,
      realReviews: 3.2,
      fakeSolds: 7,
      realSolds: 3,
      categoryIds: [categoryId, otherCategoryId],
      images: [
        { key: 'temp-main', url: '/uploads/main.png', isMain: true, position: 0 },
        { key: 'temp-side', url: '/uploads/side.png', isMain: false, position: 1 },
      ],
      variants: [
        { key: 'temp-variant', name: 'Color', value: 'Black', price: 0, imageKey: 'temp-main' },
      ],
      ...overrides,
    };
  }

  it('lets system and manager create categories and reports duplicate name/ref', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/admin/categories')
      .set('Cookie', systemCookie)
      .send(categoryPayload(categoryName, categoryRef))
      .expect(201);
    categoryId = created.body.id;
    expect(created.body).toMatchObject({ name: categoryName, ref: categoryRef });

    const byManager = await request(app.getHttpServer())
      .post('/v1/admin/categories')
      .set('Cookie', managerCookie)
      .send(categoryPayload(otherCategoryName, otherCategoryRef))
      .expect(201);
    otherCategoryId = byManager.body.id;

    const spare = await request(app.getHttpServer())
      .post('/v1/admin/categories')
      .set('Cookie', systemCookie)
      .send(categoryPayload(spareCategoryName, spareCategoryRef))
      .expect(201);
    spareCategoryId = spare.body.id;

    const duplicateName = await request(app.getHttpServer())
      .post('/v1/admin/categories')
      .set('Cookie', systemCookie)
      .send(categoryPayload(categoryName, `other-${stamp}`))
      .expect(409);
    expect(message(duplicateName.body)).toBe('A category with this name already exists.');

    const duplicateRef = await request(app.getHttpServer())
      .post('/v1/admin/categories')
      .set('Cookie', systemCookie)
      .send(categoryPayload(`Other ${stamp}`, categoryRef))
      .expect(409);
    expect(message(duplicateRef.body)).toBe('A category with this ref already exists.');
  });

  it('lets an agent read categories but not change them', async () => {
    const list = await request(app.getHttpServer())
      .get('/v1/admin/categories')
      .set('Cookie', agentCookie)
      .expect(200);
    expect(list.body.map((item: { ref: string }) => item.ref)).toEqual(
      expect.arrayContaining([categoryRef, otherCategoryRef]),
    );

    await request(app.getHttpServer())
      .get(`/v1/admin/categories/${categoryId}`)
      .set('Cookie', agentCookie)
      .expect(200)
      .expect(({ body }) => expect(body.ref).toBe(categoryRef));

    await request(app.getHttpServer())
      .post('/v1/admin/categories')
      .set('Cookie', agentCookie)
      .send(categoryPayload('Forbidden', `forbidden-${stamp}`))
      .expect(403);
    await request(app.getHttpServer())
      .put(`/v1/admin/categories/${categoryId}`)
      .set('Cookie', agentCookie)
      .send(categoryPayload(categoryName, categoryRef))
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/v1/admin/categories/${categoryId}`)
      .set('Cookie', agentCookie)
      .expect(403);
  });

  it('creates and updates a product with a full replacement payload', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/admin/products')
      .set('Cookie', systemCookie)
      .send(productPayload(productRef))
      .expect(201);

    productId = created.body.id;
    mainImageId = created.body.images.find((image: { isMain: boolean }) => image.isMain).id;
    variantId = created.body.variants[0].id;

    expect(created.body.subtitle).toBe('A subtitle');
    expect(created.body.price).toBe(19.99);
    expect(created.body.categories.map((item: { id: string }) => item.id).sort()).toEqual(
      [categoryId, otherCategoryId].sort(),
    );
    expect(created.body.images).toHaveLength(2);
    expect(created.body.images.filter((image: { isMain: boolean }) => image.isMain)).toHaveLength(1);
    expect(created.body.variants[0].imageKey).toBe(created.body.images[0].key);

    const updated = await request(app.getHttpServer())
      .put(`/v1/admin/products/${productId}`)
      .set('Cookie', managerCookie)
      .send(productPayload(productRef, {
        name: `Updated ${productRef}`,
        categoryIds: [categoryId],
        images: [
          { key: mainImageId, url: '/uploads/main.png', isMain: true, position: 0 },
          { key: 'temp-replacement', url: '/uploads/replacement.png', isMain: false, position: 1 },
        ],
        variants: [
          { key: variantId, name: 'Color', value: 'White', price: 1, imageKey: 'temp-replacement' },
        ],
      }))
      .expect(200);

    const newImageId = updated.body.images.find(
      (image: { url: string }) => image.url === '/uploads/replacement.png',
    ).id;
    expect(updated.body.name).toBe(`Updated ${productRef}`);
    expect(updated.body.categories).toHaveLength(1);
    expect(updated.body.images.find((image: { isMain: boolean }) => image.isMain).id).toBe(mainImageId);
    expect(updated.body.images.filter((image: { isMain: boolean }) => image.isMain)).toHaveLength(1);
    expect(updated.body.variants[0]).toMatchObject({
      id: variantId,
      imageId: newImageId,
      value: 'White',
      price: 1,
    });
  });

  it('lets any admin read products but blocks agent writes', async () => {
    const list = await request(app.getHttpServer())
      .get('/v1/admin/products')
      .set('Cookie', agentCookie)
      .expect(200);
    expect(list.body.map((item: { ref: string }) => item.ref)).toContain(productRef);

    await request(app.getHttpServer())
      .get(`/v1/admin/products/${productId}`)
      .set('Cookie', agentCookie)
      .expect(200)
      .expect(({ body }) => expect(body.ref).toBe(productRef));

    await request(app.getHttpServer())
      .post('/v1/admin/products')
      .set('Cookie', agentCookie)
      .send(productPayload(`forbidden-${stamp}`))
      .expect(403);
    await request(app.getHttpServer())
      .put(`/v1/admin/products/${productId}`)
      .set('Cookie', agentCookie)
      .send(productPayload(productRef))
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/v1/admin/products/${productId}`)
      .set('Cookie', agentCookie)
      .expect(403);
  });

  it('reports duplicate product refs and validates catalog payloads', async () => {
    const duplicate = await request(app.getHttpServer())
      .post('/v1/admin/products')
      .set('Cookie', systemCookie)
      .send(productPayload(productRef))
      .expect(409);
    expect(message(duplicate.body)).toBe('A product with this ref already exists.');

    const cases: Array<[string, Record<string, unknown>, string]> = [
      [
        'no main image',
        { images: [
          { key: 'a', url: '/a.png', isMain: false, position: 0 },
          { key: 'b', url: '/b.png', isMain: false, position: 1 },
        ] },
        'Exactly one image must be marked as main.',
      ],
      [
        'two main images',
        { images: [
          { key: 'a', url: '/a.png', isMain: true, position: 0 },
          { key: 'b', url: '/b.png', isMain: true, position: 1 },
        ] },
        'Exactly one image must be marked as main.',
      ],
      [
        'unknown variant imageKey',
        { variants: [{ name: 'Color', value: 'Red', price: 0, imageKey: 'nope' }] },
        'Each variant imageKey must reference an image in this product.',
      ],
      [
        'duplicate image keys',
        { images: [
          { key: 'a', url: '/a.png', isMain: true, position: 0 },
          { key: 'a', url: '/b.png', isMain: false, position: 1 },
        ] },
        'Image keys must be unique.',
      ],
      [
        'no categories',
        { categoryIds: [] },
        'categoryIds should not be empty',
      ],
      [
        'rating above five',
        { fakeReviews: 5.5 },
        'fakeReviews must not be greater than 5',
      ],
      [
        'rating with two decimals',
        { realReviews: 4.55 },
        'realReviews must have at most one decimal place',
      ],
    ];

    for (const [label, overrides, expected] of cases) {
      const response = await request(app.getHttpServer())
        .post('/v1/admin/products')
        .set('Cookie', systemCookie)
        .send(productPayload(`bad-${label.length}-${stamp}`, overrides))
        .expect(400);
      expect(message(response.body), label).toContain(expected);
    }
  });

  it('lets a manager create and delete a product', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/admin/products')
      .set('Cookie', managerCookie)
      .send(productPayload(secondProductRef))
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/v1/admin/products/${created.body.id}`)
      .set('Cookie', managerCookie)
      .expect(204);
  });

  it('refuses to delete a category that is still used by a product', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/v1/admin/categories/${categoryId}`)
      .set('Cookie', systemCookie)
      .expect(409);
    expect(message(response.body)).toBe(
      'This category is still used by products and cannot be deleted.',
    );

    await request(app.getHttpServer())
      .delete(`/v1/admin/categories/${spareCategoryId}`)
      .set('Cookie', systemCookie)
      .expect(204);
  });

  it('uploads images for managers only and serves them statically', async () => {
    const forbidden = await request(app.getHttpServer())
      .post('/v1/admin/uploads')
      .set('Cookie', agentCookie)
      .attach('file', png, { filename: 'pixel.png', contentType: 'image/png' })
      .expect(403);
    expect(message(forbidden.body)).toBe('Insufficient permissions');

    const uploaded = await request(app.getHttpServer())
      .post('/v1/admin/uploads')
      .set('Cookie', managerCookie)
      .attach('file', png, { filename: 'pixel.png', contentType: 'image/png' })
      .expect(201);
    expect(uploaded.body.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    uploadedFiles.push(path.resolve(process.cwd(), uploaded.body.url.replace(/^\//, '')));

    const served = await request(app.getHttpServer())
      .get(uploaded.body.url)
      .expect(200);
    expect(served.headers['content-type']).toContain('image/png');

    const badMime = await request(app.getHttpServer())
      .post('/v1/admin/uploads')
      .set('Cookie', systemCookie)
      .attach('file', Buffer.from('not an image'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    expect(message(badMime.body)).toBe('Only JPEG, PNG, WebP and GIF images are allowed.');
  });

  it('cleans up its catalog data', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/admin/products/${productId}`)
      .set('Cookie', systemCookie)
      .expect(204);

    expect(await dataSource.getRepository(Product).findOneBy({ ref: productRef })).toBeNull();
    expect(await dataSource.getRepository(Category).findOneBy({ ref: spareCategoryRef })).toBeNull();
  });
});
