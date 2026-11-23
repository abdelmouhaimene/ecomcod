import { MigrationInterface, QueryRunner } from 'typeorm';

/** Global home-page gallery: photos plus a singleton visibility toggle. */
export class CreateGallery1795412400000 implements MigrationInterface {
    name = 'CreateGallery1795412400000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "gallery_photos" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "image" character varying(500) NOT NULL,
            "name" character varying(100) NOT NULL,
            "date" date NOT NULL,
            "location" character varying(100) NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_gallery_photos" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_gallery_photos_date"
          ON "gallery_photos" ("date" DESC, "createdAt" DESC)
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "gallery_settings" (
            "id" integer NOT NULL,
            "isActive" boolean NOT NULL DEFAULT false,
            CONSTRAINT "PK_gallery_settings" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          INSERT INTO "gallery_settings" ("id", "isActive")
          SELECT 1, false
          WHERE NOT EXISTS (SELECT 1 FROM "gallery_settings" WHERE "id" = 1)
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "gallery_settings"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "gallery_photos"`);
    }
}
