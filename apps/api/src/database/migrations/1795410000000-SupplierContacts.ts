import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Optional contact details for suppliers. The columns are nullable so existing
 * rows stay valid; IF NOT EXISTS keeps this safe on partially synchronized
 * databases.
 */
export class SupplierContacts1795410000000 implements MigrationInterface {
    name = 'SupplierContacts1795410000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "suppliers"
            ADD COLUMN IF NOT EXISTS "address" character varying(300),
            ADD COLUMN IF NOT EXISTS "phone" character varying(50),
            ADD COLUMN IF NOT EXISTS "email" character varying(150),
            ADD COLUMN IF NOT EXISTS "description" text
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "suppliers"
            DROP COLUMN IF EXISTS "address",
            DROP COLUMN IF EXISTS "phone",
            DROP COLUMN IF EXISTS "email",
            DROP COLUMN IF EXISTS "description"
        `);
    }
}
