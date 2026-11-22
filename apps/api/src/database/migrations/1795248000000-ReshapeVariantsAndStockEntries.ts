import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits flat variant rows into definitions + values and reshapes stock entry
 * items from one row per SKU into one product-level row with combination lines.
 * The backfill preserves existing ids and total quantities/costs so stock
 * history keeps pointing at valid rows.
 */
export class ReshapeVariantsAndStockEntries1795248000000 implements MigrationInterface {
    name = 'ReshapeVariantsAndStockEntries1795248000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await this.reshapeVariants(queryRunner);
        await this.reshapeStock(queryRunner);
    }

    private async reshapeVariants(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "product_variant_definitions" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "productId" uuid NOT NULL,
            "name" character varying(100) NOT NULL,
            "variantType" character varying(30) NOT NULL DEFAULT 'OTHER',
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_product_variant_definitions" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "product_variant_values" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "variantId" uuid NOT NULL,
            "value" character varying(100) NOT NULL,
            "hexColor" character varying(7),
            "imageId" uuid,
            "position" integer NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_product_variant_values" PRIMARY KEY ("id")
          )
        `);

        // An image is optional for a variant value; existing installs keep the
        // constraint from the original creation migration, so drop it here too.
        await queryRunner.query(`
          ALTER TABLE "product_variant_values" ALTER COLUMN "imageId" DROP NOT NULL
        `);

        const legacyVariants = await queryRunner.query(`
          SELECT 1 FROM information_schema.columns
          WHERE "table_name" = 'product_variants' AND "column_name" = 'value'
          LIMIT 1
        `);

        if (legacyVariants.length > 0) {
            await queryRunner.query(`
              WITH grouped AS (
                SELECT
                  "productId",
                  "variantType",
                  CASE WHEN "variantType" = 'OTHER' THEN lower(trim("name")) ELSE "variantType" END AS "dimension",
                  min(trim("name")) FILTER (WHERE trim("name") <> '') AS "sampleName",
                  min("createdAt") AS "createdAt"
                FROM "product_variants"
                GROUP BY "productId", "variantType",
                  CASE WHEN "variantType" = 'OTHER' THEN lower(trim("name")) ELSE "variantType" END
              )
              INSERT INTO "product_variant_definitions"
                ("id", "productId", "name", "variantType", "createdAt")
              SELECT
                gen_random_uuid(),
                "productId",
                COALESCE("sampleName", "variantType"),
                "variantType",
                "createdAt"
              FROM grouped
              WHERE NOT EXISTS (
                SELECT 1 FROM "product_variant_definitions" d
                WHERE d."productId" = grouped."productId"
                  AND d."variantType" = grouped."variantType"
                  AND CASE WHEN d."variantType" = 'OTHER' THEN lower(d."name") ELSE d."variantType" END = grouped."dimension"
              )
            `);

            await queryRunner.query(`
              INSERT INTO "product_variant_values"
                ("id", "variantId", "value", "hexColor", "imageId", "position", "createdAt")
              SELECT
                v."id",
                d."id",
                v."value",
                v."hexColor",
                v."imageId",
                (row_number() OVER (PARTITION BY d."id" ORDER BY v."createdAt", v."value") - 1)::int,
                v."createdAt"
              FROM "product_variants" v
              JOIN "product_variant_definitions" d
                ON d."productId" = v."productId"
               AND d."variantType" = v."variantType"
               AND CASE WHEN d."variantType" = 'OTHER' THEN lower(d."name") ELSE d."variantType" END
                   = CASE WHEN v."variantType" = 'OTHER' THEN lower(trim(v."name")) ELSE v."variantType" END
              WHERE NOT EXISTS (
                SELECT 1 FROM "product_variant_values" pv WHERE pv."id" = v."id"
              )
            `);
        }

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "product_sku_variant_values" (
            "skuId" uuid NOT NULL,
            "variantValueId" uuid NOT NULL,
            CONSTRAINT "PK_product_sku_variant_values" PRIMARY KEY ("skuId", "variantValueId")
          )
        `);

        await queryRunner.query(`
          DO $$
          DECLARE constraint_row record;
          BEGIN
            IF to_regclass('product_sku_variants') IS NOT NULL THEN
              INSERT INTO "product_sku_variant_values" ("skuId", "variantValueId")
              SELECT j."skuId", v."id"
              FROM "product_sku_variants" j
              JOIN "product_variant_values" v ON v."id" = j."variantId"
              WHERE NOT EXISTS (
                SELECT 1 FROM "product_sku_variant_values" nj
                WHERE nj."skuId" = j."skuId" AND nj."variantValueId" = v."id"
              );

              FOR constraint_row IN
                SELECT conname FROM pg_constraint WHERE conrelid = 'product_sku_variants'::regclass
              LOOP
                EXECUTE format('ALTER TABLE "product_sku_variants" DROP CONSTRAINT %I', constraint_row.conname);
              END LOOP;

              DROP TABLE "product_sku_variants";
            END IF;
          END $$
        `);

        await queryRunner.query(`
          DO $$
          DECLARE constraint_row record;
          BEGIN
            IF to_regclass('product_variants') IS NOT NULL THEN
              FOR constraint_row IN
                SELECT conname, conrelid::regclass AS table_name
                FROM pg_constraint
                WHERE confrelid = 'product_variants'::regclass
              LOOP
                EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', constraint_row.table_name, constraint_row.conname);
              END LOOP;

              DROP TABLE "product_variants" CASCADE;
            END IF;
          END $$
        `);

        await queryRunner.query(`
          ALTER TABLE "product_variant_definitions" RENAME TO "product_variants"
        `);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'PK_product_variant_definitions' AND conrelid = 'product_variants'::regclass
            ) THEN
              ALTER TABLE "product_variants" RENAME CONSTRAINT "PK_product_variant_definitions" TO "PK_product_variants";
            END IF;
          END $$
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_product_variants_product" ON "product_variants" ("productId")
        `);
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_builtin"
            ON "product_variants" ("productId", "variantType") WHERE "variantType" <> 'OTHER'
        `);
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_other"
            ON "product_variants" ("productId", lower("name")) WHERE "variantType" = 'OTHER'
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_product_variant_values_variant" ON "product_variant_values" ("variantId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_product_variant_values_image" ON "product_variant_values" ("imageId")
        `);
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variant_values_definition_value"
            ON "product_variant_values" ("variantId", "value")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_product_sku_variant_values_value"
            ON "product_sku_variant_values" ("variantValueId")
        `);

        await this.addConstraint(
            queryRunner,
            'CHK_product_variants_variant_type',
            'product_variants',
            `"variantType" IN ('COLOR', 'SIZE_TEXT', 'SIZE_NUM', 'DESIGN', 'OTHER')`,
        );
        await this.addConstraint(
            queryRunner,
            'CHK_product_variant_values_hex',
            'product_variant_values',
            `"hexColor" IS NULL OR "hexColor" ~ '^#[0-9A-Fa-f]{6}$'`,
        );

        await this.addForeignKey(
            queryRunner,
            'FK_product_variants_product',
            'product_variants',
            'productId',
            'products',
        );
        await this.addForeignKey(
            queryRunner,
            'FK_product_variant_values_variant',
            'product_variant_values',
            'variantId',
            'product_variants',
        );
        await this.addForeignKey(
            queryRunner,
            'FK_product_variant_values_image',
            'product_variant_values',
            'imageId',
            'product_images',
        );
        await this.addForeignKey(
            queryRunner,
            'FK_product_sku_variant_values_sku',
            'product_sku_variant_values',
            'skuId',
            'product_skus',
        );
        await this.addForeignKey(
            queryRunner,
            'FK_product_sku_variant_values_value',
            'product_sku_variant_values',
            'variantValueId',
            'product_variant_values',
        );
    }

    private async reshapeStock(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "stock_entry_combinations" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "entryItemId" uuid NOT NULL,
            "skuId" uuid NOT NULL,
            "quantity" integer NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_stock_entry_combinations" PRIMARY KEY ("id")
          )
        `);
        await queryRunner.query(`
          ALTER TABLE "stock_entry_items"
            ADD COLUMN IF NOT EXISTS "buyingPrice" numeric(12,2),
            ADD COLUMN IF NOT EXISTS "totalQuantity" integer
        `);

        const legacyItems = await queryRunner.query(`
          SELECT 1 FROM information_schema.columns
          WHERE "table_name" = 'stock_entry_items' AND "column_name" = 'skuId'
          LIMIT 1
        `);

        if (legacyItems.length > 0) {
            await queryRunner.query(`
              CREATE TEMP TABLE "stock_item_migration_map" AS
              SELECT
                i."id" AS "oldId",
                (
                  SELECT k."id" FROM "stock_entry_items" k
                  WHERE k."entryId" = i."entryId" AND k."productId" = i."productId"
                  ORDER BY k."createdAt", k."id" LIMIT 1
                ) AS "keeperId"
              FROM "stock_entry_items" i
              WHERE i."buyingPrice" IS NULL
            `);

            await queryRunner.query(`
              UPDATE "stock_entry_items" k
              SET
                "buyingPrice" = g."buyingPrice",
                "totalQuantity" = g."totalQuantity",
                "lineTotal" = g."lineTotal"
              FROM (
                SELECT
                  m."keeperId",
                  round(sum(i."quantity" * i."unitPrice")::numeric / NULLIF(sum(i."quantity"), 0), 2) AS "buyingPrice",
                  sum(i."quantity") AS "totalQuantity",
                  sum(i."lineTotal") AS "lineTotal"
                FROM "stock_item_migration_map" m
                JOIN "stock_entry_items" i ON i."id" = m."oldId"
                GROUP BY m."keeperId"
              ) g
              WHERE k."id" = g."keeperId"
            `);

            await queryRunner.query(`
              INSERT INTO "stock_entry_combinations"
                ("id", "entryItemId", "skuId", "quantity", "createdAt")
              SELECT
                gen_random_uuid(),
                m."keeperId",
                i."skuId",
                i."quantity",
                i."createdAt"
              FROM "stock_item_migration_map" m
              JOIN "stock_entry_items" i ON i."id" = m."oldId"
              WHERE NOT EXISTS (
                SELECT 1 FROM "stock_entry_combinations" c
                WHERE c."entryItemId" = m."keeperId" AND c."skuId" = i."skuId"
              )
            `);

            await queryRunner.query(`
              UPDATE "stock_movements" m
              SET "unitPrice" = p."buyingPrice"
              FROM (
                SELECT "entryId", "productId", "buyingPrice"
                FROM "stock_entry_items"
                WHERE "buyingPrice" IS NOT NULL
              ) p
              WHERE m."sourceType" = 'ENTRY'
                AND m."stockEntryId" = p."entryId"
                AND m."productId" = p."productId"
            `);

            await queryRunner.query(`
              DELETE FROM "stock_entry_items" i
              USING "stock_item_migration_map" m
              WHERE i."id" = m."oldId" AND i."id" <> m."keeperId"
            `);
        }

        await queryRunner.query(`
          UPDATE "stock_entry_items" SET "buyingPrice" = 0 WHERE "buyingPrice" IS NULL
        `);
        await queryRunner.query(`
          UPDATE "stock_entry_items" SET "totalQuantity" = 1 WHERE "totalQuantity" IS NULL
        `);
        await queryRunner.query(`
          ALTER TABLE "stock_entry_items" ALTER COLUMN "buyingPrice" SET NOT NULL
        `);
        await queryRunner.query(`
          ALTER TABLE "stock_entry_items" ALTER COLUMN "totalQuantity" SET NOT NULL
        `);

        await queryRunner.query(`
          DO $$
          DECLARE constraint_row record;
          BEGIN
            FOR constraint_row IN
              SELECT conname FROM pg_constraint
              WHERE conrelid = 'stock_entry_items'::regclass
                AND (conname LIKE '%sku%' OR conname LIKE '%quantity%' OR conname LIKE '%unit_price%')
            LOOP
              EXECUTE format('ALTER TABLE "stock_entry_items" DROP CONSTRAINT %I', constraint_row.conname);
            END LOOP;
          END $$
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_entry_items_sku"`);
        await queryRunner.query(`
          ALTER TABLE "stock_entry_items"
            DROP COLUMN IF EXISTS "skuId",
            DROP COLUMN IF EXISTS "quantity",
            DROP COLUMN IF EXISTS "unitPrice"
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_entry_combinations_entry_item"
            ON "stock_entry_combinations" ("entryItemId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_entry_combinations_sku"
            ON "stock_entry_combinations" ("skuId")
        `);
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_entry_combinations_item_sku"
            ON "stock_entry_combinations" ("entryItemId", "skuId")
        `);

        await this.addConstraint(
            queryRunner,
            'CHK_stock_entry_items_buying_price',
            'stock_entry_items',
            `"buyingPrice" >= 0`,
        );
        await this.addConstraint(
            queryRunner,
            'CHK_stock_entry_items_total_quantity',
            'stock_entry_items',
            `"totalQuantity" > 0`,
        );
        await this.addConstraint(
            queryRunner,
            'CHK_stock_entry_combinations_quantity',
            'stock_entry_combinations',
            `"quantity" >= 0`,
        );

        await this.addForeignKey(
            queryRunner,
            'FK_stock_entry_combinations_entry_item',
            'stock_entry_combinations',
            'entryItemId',
            'stock_entry_items',
            'CASCADE',
        );
        await this.addForeignKey(
            queryRunner,
            'FK_stock_entry_combinations_sku',
            'stock_entry_combinations',
            'skuId',
            'product_skus',
            'RESTRICT',
        );

        await queryRunner.query(`
          DO $$
          DECLARE sku_row record;
                  movement_row record;
                  current_quantity integer;
                  next_quantity integer;
                  current_pmp numeric(12,2);
          BEGIN
            IF to_regclass('product_skus') IS NOT NULL AND to_regclass('stock_movements') IS NOT NULL THEN
              FOR sku_row IN SELECT "id" FROM "product_skus" LOOP
                current_quantity := 0;
                current_pmp := 0;
                FOR movement_row IN
                  SELECT "sourceType", "quantity", "unitPrice"
                  FROM "stock_movements"
                  WHERE "skuId" = sku_row."id"
                  ORDER BY "createdAt", "id"
                LOOP
                  IF movement_row."sourceType" = 'ENTRY' THEN
                    next_quantity := current_quantity + movement_row."quantity";
                    IF next_quantity > 0 THEN
                      current_pmp := round(
                        current_pmp + ((movement_row."unitPrice" - current_pmp) * movement_row."quantity")::numeric / next_quantity,
                        2
                      );
                    ELSE
                      current_pmp := 0;
                    END IF;
                    current_quantity := next_quantity;
                  ELSE
                    current_quantity := current_quantity + movement_row."quantity";
                    IF current_quantity <= 0 THEN
                      current_pmp := 0;
                    END IF;
                  END IF;
                END LOOP;
                UPDATE "product_skus"
                SET "stockQuantity" = current_quantity, "PMP" = current_pmp
                WHERE "id" = sku_row."id";
              END LOOP;

              UPDATE "products" p
              SET "quantity" = agg."quantity", "PMP" = agg."PMP"
              FROM (
                SELECT
                  s."productId",
                  sum(s."stockQuantity") AS "quantity",
                  CASE WHEN sum(s."stockQuantity") > 0
                    THEN round(sum(s."PMP" * s."stockQuantity")::numeric / sum(s."stockQuantity"), 2)
                    ELSE 0 END AS "PMP"
                FROM "product_skus" s
                WHERE s."isActive" = true
                GROUP BY s."productId"
              ) agg
              WHERE p."id" = agg."productId";
            END IF;
          END $$
        `);
    }

    private async addConstraint(
        queryRunner: QueryRunner,
        name: string,
        table: string,
        expression: string,
    ): Promise<void> {
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

    private async addForeignKey(
        queryRunner: QueryRunner,
        name: string,
        table: string,
        column: string,
        referencedTable: string,
        onDelete = 'CASCADE',
    ): Promise<void> {
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

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "product_sku_variants" (
            "skuId" uuid NOT NULL,
            "variantId" uuid NOT NULL,
            CONSTRAINT "PK_product_sku_variants" PRIMARY KEY ("skuId", "variantId")
          )
        `);
        await queryRunner.query(`
          INSERT INTO "product_sku_variants" ("skuId", "variantId")
          SELECT "skuId", "variantValueId" FROM "product_sku_variant_values"
          ON CONFLICT DO NOTHING
        `);
        await queryRunner.query(`DROP TABLE IF EXISTS "product_sku_variant_values" CASCADE`);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "product_variants_legacy" (
            "id" uuid NOT NULL,
            "productId" uuid NOT NULL,
            "name" character varying(100) NOT NULL,
            "value" character varying(100) NOT NULL,
            "variantType" character varying(30) NOT NULL DEFAULT 'OTHER',
            "hexColor" character varying(7),
            "imageId" uuid,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_product_variants_legacy" PRIMARY KEY ("id")
          )
        `);
        await queryRunner.query(`
          INSERT INTO "product_variants_legacy"
            ("id", "productId", "name", "value", "variantType", "hexColor", "imageId", "createdAt")
          SELECT
            v."id", d."productId", d."name", v."value", d."variantType",
            v."hexColor", v."imageId", v."createdAt"
          FROM "product_variant_values" v
          JOIN "product_variants" d ON d."id" = v."variantId"
          ON CONFLICT ("id") DO NOTHING
        `);
        await queryRunner.query(`DROP TABLE IF EXISTS "product_variant_values" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "product_variants" CASCADE`);
        await queryRunner.query(`ALTER TABLE "product_variants_legacy" RENAME TO "product_variants"`);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'PK_product_variants_legacy' AND conrelid = 'product_variants'::regclass
            ) THEN
              ALTER TABLE "product_variants" RENAME CONSTRAINT "PK_product_variants_legacy" TO "PK_product_variants";
            END IF;
          END $$
        `);

        await queryRunner.query(`
          ALTER TABLE "stock_entry_items"
            ADD COLUMN IF NOT EXISTS "skuId" uuid,
            ADD COLUMN IF NOT EXISTS "quantity" integer,
            ADD COLUMN IF NOT EXISTS "unitPrice" numeric(12,2)
        `);
        await queryRunner.query(`
          INSERT INTO "stock_entry_items"
            ("id", "entryId", "productId", "skuId", "quantity", "unitPrice", "lineTotal", "createdAt")
          SELECT
            gen_random_uuid(), i."entryId", i."productId", c."skuId", c."quantity",
            i."buyingPrice", round(c."quantity" * i."buyingPrice", 2), c."createdAt"
          FROM "stock_entry_items" i
          JOIN "stock_entry_combinations" c ON c."entryItemId" = i."id"
        `);
        await queryRunner.query(`
          DELETE FROM "stock_entry_items" WHERE "skuId" IS NULL
        `);
        await queryRunner.query(`DROP TABLE IF EXISTS "stock_entry_combinations" CASCADE`);
        await queryRunner.query(`
          ALTER TABLE "stock_entry_items"
            DROP COLUMN IF EXISTS "buyingPrice",
            DROP COLUMN IF EXISTS "totalQuantity"
        `);
    }
}
