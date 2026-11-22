import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Offers are defined per product only. The client picks the concrete variant
 * (SKU) for each offered product when applying the offer at checkout, so the
 * stored skuId columns and their foreign keys are no longer needed.
 */
export class ProductScopedOffers1795324400000 implements MigrationInterface {
    name = 'ProductScopedOffers1795324400000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_offer_single_rules_sku') THEN
              ALTER TABLE "offer_single_rules" DROP CONSTRAINT "FK_offer_single_rules_sku";
            END IF;
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_offer_pack_items_sku') THEN
              ALTER TABLE "offer_pack_items" DROP CONSTRAINT "FK_offer_pack_items_sku";
            END IF;
          END $$
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_offer_single_rules_sku"`);
        await queryRunner.query(`ALTER TABLE "offer_single_rules" DROP COLUMN IF EXISTS "skuId"`);
        await queryRunner.query(`ALTER TABLE "offer_pack_items" DROP COLUMN IF EXISTS "skuId"`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "offer_single_rules" ADD COLUMN IF NOT EXISTS "skuId" uuid`);
        await queryRunner.query(`ALTER TABLE "offer_pack_items" ADD COLUMN IF NOT EXISTS "skuId" uuid`);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_offer_single_rules_sku"
            ON "offer_single_rules" ("skuId")
        `);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_offer_single_rules_sku') THEN
              ALTER TABLE "offer_single_rules"
                ADD CONSTRAINT "FK_offer_single_rules_sku"
                FOREIGN KEY ("skuId") REFERENCES "product_skus" ("id") ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_offer_pack_items_sku') THEN
              ALTER TABLE "offer_pack_items"
                ADD CONSTRAINT "FK_offer_pack_items_sku"
                FOREIGN KEY ("skuId") REFERENCES "product_skus" ("id") ON DELETE RESTRICT;
            END IF;
          END $$
        `);
    }
}
