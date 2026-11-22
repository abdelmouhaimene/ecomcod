import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds product families, offers and orders. Categories keep their existing
 * explicit `product_categories` join entity; families use a separate join table.
 */
export class CreateFamiliesOffersOrders1795152000000 implements MigrationInterface {
    name = 'CreateFamiliesOffersOrders1795152000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "families" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "name" character varying(100) NOT NULL,
            "ref" character varying(50) NOT NULL,
            "description" text,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_families" PRIMARY KEY ("id")
          )
        `);
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "product_families" (
            "familyId" uuid NOT NULL,
            "productId" uuid NOT NULL,
            CONSTRAINT "PK_product_families" PRIMARY KEY ("familyId", "productId")
          )
        `);
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "offers" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "name" character varying(150) NOT NULL,
            "type" character varying(30) NOT NULL,
            "isActive" boolean NOT NULL DEFAULT true,
            "startsAt" TIMESTAMPTZ,
            "endsAt" TIMESTAMPTZ,
            "packPrice" numeric(12,2),
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_offers" PRIMARY KEY ("id")
          )
        `);
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "offer_single_rules" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "offerId" uuid NOT NULL,
            "productId" uuid NOT NULL,
            "skuId" uuid NOT NULL,
            "mode" character varying(40) NOT NULL,
            "buyQuantity" integer NOT NULL,
            "freeQuantity" integer,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_offer_single_rules" PRIMARY KEY ("id")
          )
        `);
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "offer_pack_items" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "offerId" uuid NOT NULL,
            "productId" uuid NOT NULL,
            "skuId" uuid NOT NULL,
            "quantity" integer NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_offer_pack_items" PRIMARY KEY ("id")
          )
        `);
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "orders" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "orderNumber" character varying(40) NOT NULL,
            "source" character varying(20) NOT NULL,
            "status" character varying(20) NOT NULL DEFAULT 'COMPLETED',
            "customerName" character varying(150),
            "customerEmail" character varying(200),
            "notes" text,
            "subtotal" numeric(12,2) NOT NULL,
            "discount" numeric(12,2) NOT NULL DEFAULT 0,
            "shippingCost" numeric(12,2) NOT NULL DEFAULT 0,
            "taxAmount" numeric(12,2) NOT NULL DEFAULT 0,
            "total" numeric(12,2) NOT NULL,
            "freeShipping" boolean NOT NULL DEFAULT false,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_orders" PRIMARY KEY ("id")
          )
        `);
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "order_items" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "orderId" uuid NOT NULL,
            "skuId" uuid NOT NULL,
            "productId" uuid NOT NULL,
            "sku" character varying(150) NOT NULL,
            "productName" character varying(150) NOT NULL,
            "quantity" integer NOT NULL,
            "unitPrice" numeric(12,2) NOT NULL,
            "lineTotal" numeric(12,2) NOT NULL,
            "kind" character varying(30) NOT NULL,
            "offerId" uuid,
            "offerName" character varying(150),
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_order_items" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_families_name" ON "families" ("name")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_families_ref" ON "families" ("ref")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_families_product" ON "product_families" ("productId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_offers_name" ON "offers" ("name")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_offers_active" ON "offers" ("isActive")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_offer_single_rules_offer" ON "offer_single_rules" ("offerId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_offer_single_rules_sku" ON "offer_single_rules" ("skuId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_offer_pack_items_offer" ON "offer_pack_items" ("offerId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_offer_pack_items_offer_product" ON "offer_pack_items" ("offerId", "productId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_orders_number" ON "orders" ("orderNumber")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_created" ON "orders" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_items_order" ON "order_items" ("orderId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_items_sku" ON "order_items" ("skuId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_items_offer" ON "order_items" ("offerId")`);

        const checks: Array<[string, string, string]> = [
            [
                'CHK_offers_price_shape',
                'offers',
                `("type" = 'PACK' AND "packPrice" IS NOT NULL)
                  OR ("type" = 'SINGLE_PRODUCT' AND "packPrice" IS NULL)`,
            ],
            ['CHK_offer_single_rules_buy', 'offer_single_rules', '"buyQuantity" > 0'],
            [
                'CHK_offer_single_rules_free',
                'offer_single_rules',
                `("mode" = 'BUY_X_GET_Y_FREE' AND "freeQuantity" > 0)
                  OR ("mode" = 'BUY_X_GET_FREE_SHIPPING' AND "freeQuantity" IS NULL)`,
            ],
            ['CHK_offer_pack_items_quantity', 'offer_pack_items', '"quantity" > 0'],
            [
                'CHK_orders_totals',
                'orders',
                `"subtotal" >= 0 AND "discount" >= 0 AND "shippingCost" >= 0
                  AND "taxAmount" >= 0 AND "total" >= 0`,
            ],
            ['CHK_order_items_quantity', 'order_items', '"quantity" > 0'],
            ['CHK_order_items_unit_price', 'order_items', '"unitPrice" >= 0'],
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
            ['FK_product_families_family', 'product_families', 'familyId', 'families', 'CASCADE'],
            ['FK_product_families_product', 'product_families', 'productId', 'products', 'CASCADE'],
            ['FK_offers_single_rule', 'offer_single_rules', 'offerId', 'offers', 'CASCADE'],
            ['FK_offer_single_rules_product', 'offer_single_rules', 'productId', 'products', 'RESTRICT'],
            ['FK_offer_single_rules_sku', 'offer_single_rules', 'skuId', 'product_skus', 'RESTRICT'],
            ['FK_offer_pack_items_offer', 'offer_pack_items', 'offerId', 'offers', 'CASCADE'],
            ['FK_offer_pack_items_product', 'offer_pack_items', 'productId', 'products', 'RESTRICT'],
            ['FK_offer_pack_items_sku', 'offer_pack_items', 'skuId', 'product_skus', 'RESTRICT'],
            ['FK_order_items_order', 'order_items', 'orderId', 'orders', 'CASCADE'],
            ['FK_order_items_sku', 'order_items', 'skuId', 'product_skus', 'RESTRICT'],
            ['FK_order_items_product', 'order_items', 'productId', 'products', 'RESTRICT'],
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
        await queryRunner.query(`
          ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "FK_stock_movements_order"
        `);
        await queryRunner.query(`
          DROP TABLE IF EXISTS "order_items", "orders", "offer_pack_items",
            "offer_single_rules", "offers", "product_families", "families" CASCADE
        `);
    }
}
