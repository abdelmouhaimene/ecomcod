import { MigrationInterface, QueryRunner } from 'typeorm';

/** Singleton store details plus the phone and social-link lists they own. */
export class CreateStore1795413200000 implements MigrationInterface {
    name = 'CreateStore1795413200000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "store_settings" (
            "id" integer NOT NULL,
            "name" character varying(150) NOT NULL,
            "description" text NOT NULL,
            "logo" character varying(500) NOT NULL DEFAULT '',
            "email" character varying(200) NOT NULL,
            "website" character varying(300) NOT NULL DEFAULT '',
            "address" character varying(300) NOT NULL DEFAULT '',
            "mapQuery" character varying(500) NOT NULL DEFAULT '',
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_store_settings" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          INSERT INTO "store_settings"
            ("id", "name", "description", "email")
          SELECT 1, 'AURELIA TECH',
            'Precision hardware and high-grade accessories for discerning workspaces.',
            'support@aurumtech.luxury'
          WHERE NOT EXISTS (SELECT 1 FROM "store_settings" WHERE "id" = 1)
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "store_phones" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "settingId" integer NOT NULL,
            "number" character varying(50) NOT NULL,
            "position" integer NOT NULL DEFAULT 0,
            CONSTRAINT "PK_store_phones" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_store_phones_setting_position" UNIQUE ("settingId", "position")
          )
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_store_phones_setting"
          ON "store_phones" ("settingId", "position")
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "store_social_links" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "settingId" integer NOT NULL,
            "platform" character varying(20) NOT NULL,
            "url" character varying(500) NOT NULL,
            CONSTRAINT "PK_store_social_links" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_store_social_links_setting_platform" UNIQUE ("settingId", "platform")
          )
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_store_social_links_setting"
          ON "store_social_links" ("settingId", "platform")
        `);

        // PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS: guard with a DO block.
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'FK_store_phones_setting'
            ) THEN
              ALTER TABLE "store_phones"
              ADD CONSTRAINT "FK_store_phones_setting"
              FOREIGN KEY ("settingId") REFERENCES "store_settings" ("id") ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'FK_store_social_links_setting'
            ) THEN
              ALTER TABLE "store_social_links"
              ADD CONSTRAINT "FK_store_social_links_setting"
              FOREIGN KEY ("settingId") REFERENCES "store_settings" ("id") ON DELETE CASCADE;
            END IF;
          END $$
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "store_social_links"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "store_phones"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "store_settings"`);
    }
}
