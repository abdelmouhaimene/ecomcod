import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the optional home-page YouTube video to the singleton store settings. */
export class AddStoreHomeVideo1795630000000 implements MigrationInterface {
    name = 'AddStoreHomeVideo1795630000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "store_settings"
          ADD COLUMN IF NOT EXISTS "homeVideoEnabled" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
          ALTER TABLE "store_settings"
          ADD COLUMN IF NOT EXISTS "homeVideoUrl" character varying(500) NOT NULL DEFAULT ''
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN IF EXISTS "homeVideoUrl"`);
        await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN IF EXISTS "homeVideoEnabled"`);
    }
}
