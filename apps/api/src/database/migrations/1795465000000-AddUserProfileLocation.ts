import { MigrationInterface, QueryRunner } from 'typeorm';

/** Saved delivery contact location on client accounts. */
export class AddUserProfileLocation1795465000000 implements MigrationInterface {
    name = 'AddUserProfileLocation1795465000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "users"
          ADD COLUMN IF NOT EXISTS "wilayaCode" character varying(2),
          ADD COLUMN IF NOT EXISTS "wilayaName" character varying(150),
          ADD COLUMN IF NOT EXISTS "communeCode" character varying(4),
          ADD COLUMN IF NOT EXISTS "communeName" character varying(150)
        `);

        // Postgres has no ADD CONSTRAINT IF NOT EXISTS; guard with a DO block.
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'CHK_users_location_codes'
                AND conrelid = 'public.users'::regclass
            ) THEN
              ALTER TABLE "users"
              ADD CONSTRAINT "CHK_users_location_codes" CHECK (
                (
                  "wilayaCode" IS NULL AND "wilayaName" IS NULL
                  AND "communeCode" IS NULL AND "communeName" IS NULL
                ) OR (
                  "wilayaCode" ~ '^[0-9]{2}$'
                  AND "communeCode" ~ '^[0-9]{4}$'
                  AND "communeCode" LIKE "wilayaCode" || '%'
                  AND char_length("wilayaName") > 0
                  AND char_length("communeName") > 0
                )
              );
            END IF;
          END $$;
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "users"
          DROP CONSTRAINT IF EXISTS "CHK_users_location_codes"
        `);
        await queryRunner.query(`
          ALTER TABLE "users"
          DROP COLUMN IF EXISTS "communeName",
          DROP COLUMN IF EXISTS "communeCode",
          DROP COLUMN IF EXISTS "wilayaName",
          DROP COLUMN IF EXISTS "wilayaCode"
        `);
    }
}
