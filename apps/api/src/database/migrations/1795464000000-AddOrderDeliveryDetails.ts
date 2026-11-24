import { MigrationInterface, QueryRunner } from 'typeorm';

/** Delivery contact details collected by the storefront checkout. */
export class AddOrderDeliveryDetails1795464000000 implements MigrationInterface {
    name = 'AddOrderDeliveryDetails1795464000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "orders"
          ADD COLUMN IF NOT EXISTS "customerPhone" character varying(20),
          ADD COLUMN IF NOT EXISTS "wilayaCode" character varying(2),
          ADD COLUMN IF NOT EXISTS "wilayaName" character varying(150),
          ADD COLUMN IF NOT EXISTS "communeCode" character varying(4),
          ADD COLUMN IF NOT EXISTS "communeName" character varying(150)
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "orders"
          DROP COLUMN IF EXISTS "communeName",
          DROP COLUMN IF EXISTS "communeCode",
          DROP COLUMN IF EXISTS "wilayaName",
          DROP COLUMN IF EXISTS "wilayaCode",
          DROP COLUMN IF EXISTS "customerPhone"
        `);
    }
}
