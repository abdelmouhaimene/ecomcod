import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds sellable SKU combinations and movement-based stock to the existing
 * catalog. Existing stock is assigned to one DEFAULT SKU per product so no
 * quantity or PMP is lost. Safe on fresh or partially synchronized databases.
 */
export class CreateVariantSkusAndMovements1795065600000 implements MigrationInterface {
    name = 'CreateVariantSkusAndMovements1795065600000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "product_variants"
            ADD COLUMN IF NOT EXISTS "variantType" character varying(30) NOT NULL DEFAULT 'OTHER',
            ADD COLUMN IF NOT EXISTS "hexColor" character varying(7)
        `);

        // The old price column is intentionally removed: only Product.price exists.
        await queryRunner.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'CHK_product_variants_price'
                AND conrelid = 'product_variants'::regclass
            ) THEN
              ALTER TABLE "product_variants" DROP CONSTRAINT "CHK_product_variants_price";
            END IF;
          END $$
        `);
        await queryRunner.query(`ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "price"`);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "product_skus" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "productId" uuid NOT NULL,
            "sku" character varying(150) NOT NULL,
            "combinationKey" character varying(500) NOT NULL,
            "label" character varying(300) NOT NULL,
            "imageId" uuid,
            "stockQuantity" integer NOT NULL DEFAULT 0,
            "PMP" numeric(12,2) NOT NULL DEFAULT 0,
            "isActive" boolean NOT NULL DEFAULT true,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_product_skus" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "product_sku_variants" (
            "skuId" uuid NOT NULL,
            "variantId" uuid NOT NULL,
            CONSTRAINT "PK_product_sku_variants" PRIMARY KEY ("skuId", "variantId")
          )
        `);

        await queryRunner.query(`
          ALTER TABLE "stock_entry_items"
            ADD COLUMN IF NOT EXISTS "skuId" uuid
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "stock_movements" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "skuId" uuid NOT NULL,
            "productId" uuid NOT NULL,
            "sourceType" character varying(20) NOT NULL,
            "stockEntryId" uuid,
            "orderId" uuid,
            "quantity" integer NOT NULL,
            "unitPrice" numeric(12,2) NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id")
          )
        `);

        // A default SKU preserves all stock that existed before combinations.
        await queryRunner.query(`
          INSERT INTO "product_skus"
            ("id", "productId", "sku", "combinationKey", "label", "imageId",
             "stockQuantity", "PMP", "isActive", "createdAt", "updatedAt")
          SELECT
            gen_random_uuid(),
            p."id",
            UPPER(regexp_replace(p."ref", '[^A-Za-z0-9]+', '-', 'g')) || '-' ||
              substr(replace(p."id"::text, '-', ''), 1, 8) || '-DEFAULT',
            'DEFAULT',
            'Default',
            (
              SELECT i."id" FROM "product_images" i
              WHERE i."productId" = p."id"
              ORDER BY i."isMain" DESC, i."position" ASC, i."id" ASC
              LIMIT 1
            ),
            p."quantity",
            p."PMP",
            true,
            now(),
            now()
          FROM "products" p
          WHERE NOT EXISTS (
            SELECT 1 FROM "product_skus" s
            WHERE s."productId" = p."id" AND s."combinationKey" = 'DEFAULT'
          )
        `);

        await queryRunner.query(`
          UPDATE "stock_entry_items" i
          SET "skuId" = s."id"
          FROM "product_skus" s
          WHERE i."skuId" IS NULL
            AND s."productId" = i."productId"
            AND s."combinationKey" = 'DEFAULT'
        `);
        await queryRunner.query(`
          ALTER TABLE "stock_entry_items" ALTER COLUMN "skuId" SET NOT NULL
        `);

        // Seed movements from existing entry lines so future replays include them.
        await queryRunner.query(`
          INSERT INTO "stock_movements"
            ("id", "skuId", "productId", "sourceType", "stockEntryId", "orderId",
             "quantity", "unitPrice", "createdAt")
          SELECT
            gen_random_uuid(),
            i."skuId",
            i."productId",
            'ENTRY',
            i."entryId",
            NULL,
            i."quantity",
            i."unitPrice",
            i."createdAt"
          FROM "stock_entry_items" i
          WHERE NOT EXISTS (
            SELECT 1 FROM "stock_movements" m
            WHERE m."sourceType" = 'ENTRY'
              AND m."stockEntryId" = i."entryId"
              AND m."skuId" = i."skuId"
          )
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_product_skus_product" ON "product_skus" ("productId")
        `);
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_skus_product_combination"
            ON "product_skus" ("productId", "combinationKey")
        `);
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_skus_code" ON "product_skus" ("sku")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_product_sku_variants_variant" ON "product_sku_variants" ("variantId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_entry_items_sku" ON "stock_entry_items" ("skuId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_movements_sku" ON "stock_movements" ("skuId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_movements_product" ON "stock_movements" ("productId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_movements_entry" ON "stock_movements" ("stockEntryId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_movements_order" ON "stock_movements" ("orderId")
        `);

        const checks: Array<[string, string, string]> = [
            [
                'CHK_product_variants_hex',
                'product_variants',
                `("variantType" = 'COLOR' AND "hexColor" ~ '^#[0-9A-Fa-f]{6}$')
                  OR ("variantType" <> 'COLOR' AND "hexColor" IS NULL)`,
            ],
            [
                'CHK_product_variants_size_text',
                'product_variants',
                `"variantType" <> 'SIZE_TEXT' OR "value" IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL')`,
            ],
            [
                'CHK_product_variants_size_num',
                'product_variants',
                `"variantType" <> 'SIZE_NUM' OR "value" ~ '^[0-9]+(\\.[0-9]{1,2})?$'`,
            ],
            ['CHK_product_skus_stock', 'product_skus', '"stockQuantity" >= 0 AND "PMP" >= 0'],
            [
                'CHK_stock_movements_quantity',
                'stock_movements',
                `("sourceType" = 'ENTRY' AND "quantity" > 0)
                  OR ("sourceType" = 'SALE' AND "quantity" < 0)`,
            ],
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
            ['FK_product_skus_product', 'product_skus', 'productId', 'products', 'CASCADE'],
            ['FK_product_skus_image', 'product_skus', 'imageId', 'product_images', 'SET NULL'],
            ['FK_product_sku_variants_sku', 'product_sku_variants', 'skuId', 'product_skus', 'CASCADE'],
            ['FK_product_sku_variants_variant', 'product_sku_variants', 'variantId', 'product_variants', 'CASCADE'],
            ['FK_stock_entry_items_sku', 'stock_entry_items', 'skuId', 'product_skus', 'RESTRICT'],
            ['FK_stock_movements_sku', 'stock_movements', 'skuId', 'product_skus', 'CASCADE'],
            ['FK_stock_movements_product', 'stock_movements', 'productId', 'products', 'RESTRICT'],
            ['FK_stock_movements_entry', 'stock_movements', 'stockEntryId', 'stock_entries', 'CASCADE'],
            ['FK_stock_movements_order', 'stock_movements', 'orderId', 'orders', 'CASCADE'],
        ];
        for (const [name, table, column, referencedTable, onDelete] of foreignKeys) {
            await queryRunner.query(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = '${name}' AND conrelid = '${table}'::regclass
                ) AND to_regclass('${referencedTable}') IS NOT NULL THEN
                  ALTER TABLE "${table}"
                    ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}")
                    REFERENCES "${referencedTable}" ("id") ON DELETE ${onDelete};
                END IF;
              END $$
            `);
        }
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements", "product_sku_variants", "product_skus" CASCADE`);
        await queryRunner.query(`ALTER TABLE "stock_entry_items" DROP COLUMN IF EXISTS "skuId"`);
        await queryRunner.query(`
          ALTER TABLE "product_variants"
            DROP COLUMN IF EXISTS "hexColor",
            DROP COLUMN IF EXISTS "variantType",
            ADD COLUMN IF NOT EXISTS "price" numeric(12,2) NOT NULL DEFAULT 0
        `);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'CHK_product_variants_price' AND conrelid = 'product_variants'::regclass
            ) THEN
              ALTER TABLE "product_variants" ADD CONSTRAINT "CHK_product_variants_price" CHECK ("price" >= 0);
            END IF;
          END $$
        `);
    }
}
