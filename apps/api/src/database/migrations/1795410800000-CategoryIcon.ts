import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the optional category icon URL without touching existing categories. */
export class CategoryIcon1795410800000 implements MigrationInterface {
    name = 'CategoryIcon1795410800000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "icon" character varying(500)`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "icon"`);
    }
}
