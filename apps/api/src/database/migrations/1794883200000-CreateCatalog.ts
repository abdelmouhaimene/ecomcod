import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Production schema for the catalog. Safe to run on a fresh or partially
 * synchronized database: tables and indexes use IF NOT EXISTS and constraints
 * are added through DO blocks because Postgres has no ADD CONSTRAINT IF NOT EXISTS.
 */
export class CreateCatalog1794883200000 implements MigrationInterface {
  name = 'CreateCatalog1794883200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(100) NOT NULL,
        "ref" character varying(50) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ref" character varying(50) NOT NULL,
        "name" character varying(150) NOT NULL,
        "subtitle" character varying(200),
        "description" text,
        "price" numeric(12,2) NOT NULL,
        "oldPrice" numeric(12,2),
        "fakeReviews" numeric(2,1) NOT NULL DEFAULT 0,
        "realReviews" numeric(2,1) NOT NULL DEFAULT 0,
        "fakeSolds" integer NOT NULL DEFAULT 0,
        "realSolds" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_categories" (
        "productId" uuid NOT NULL,
        "categoryId" uuid NOT NULL,
        CONSTRAINT "PK_product_categories" PRIMARY KEY ("productId", "categoryId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "productId" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "isMain" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_images" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_variants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "productId" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "value" character varying(100) NOT NULL,
        "price" numeric(12,2) NOT NULL,
        "imageId" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_variants" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_name" ON "categories" ("name")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_ref" ON "categories" ("ref")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_products_ref" ON "products" ("ref")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_categories_category" ON "product_categories" ("categoryId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_images_product" ON "product_images" ("productId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_images_product_url" ON "product_images" ("productId", "url")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_images_main"
        ON "product_images" ("productId") WHERE "isMain" = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_variants_product" ON "product_variants" ("productId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_variants_image" ON "product_variants" ("imageId")
    `);

    const checks: Array<[string, string, string]> = [
      ['CHK_products_price', 'products', '"price" >= 0'],
      ['CHK_products_old_price', 'products', '"oldPrice" IS NULL OR "oldPrice" >= 0'],
      [
        'CHK_products_reviews',
        'products',
        '"fakeReviews" >= 0 AND "fakeReviews" <= 5 AND "realReviews" >= 0 AND "realReviews" <= 5',
      ],
      ['CHK_products_counters', 'products', '"fakeSolds" >= 0 AND "realSolds" >= 0'],
      ['CHK_product_images_position', 'product_images', '"position" >= 0'],
      ['CHK_product_variants_price', 'product_variants', '"price" >= 0'],
    ];
    for (const [name, table, expression] of checks) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = '${name}' AND conrelid = '${table}'::regclass
          ) THEN
            ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expression});
          END IF;
        END $$
      `);
    }

    const foreignKeys: Array<[string, string, string, string, string]> = [
      ['FK_product_categories_product', 'product_categories', 'productId', 'products', 'id'],
      ['FK_product_categories_category', 'product_categories', 'categoryId', 'categories', 'id'],
      ['FK_product_images_product', 'product_images', 'productId', 'products', 'id'],
      ['FK_product_variants_product', 'product_variants', 'productId', 'products', 'id'],
      ['FK_product_variants_image', 'product_variants', 'imageId', 'product_images', 'id'],
    ];
    for (const [name, table, column, referencedTable, referencedColumn] of foreignKeys) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = '${name}' AND conrelid = '${table}'::regclass
          ) THEN
            ALTER TABLE "${table}"
              ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}")
              REFERENCES "${referencedTable}" ("${referencedColumn}") ON DELETE CASCADE;
          END IF;
        END $$
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "product_variants", "product_images", "product_categories",
        "products", "categories" CASCADE
    `);
  }
}
