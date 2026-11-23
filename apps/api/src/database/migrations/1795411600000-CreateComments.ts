import { MigrationInterface, QueryRunner } from 'typeorm';

/** Global testimonials shown in the storefront Patron Verifications carousel. */
export class CreateComments1795411600000 implements MigrationInterface {
    name = 'CreateComments1795411600000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "comments" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "username" character varying(100) NOT NULL,
            "userImage" character varying(500),
            "content" text NOT NULL,
            "rating" smallint NOT NULL,
            "source" character varying(10) NOT NULL DEFAULT 'USER',
            "userId" uuid,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_comments" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_comments_createdAt" ON "comments" ("createdAt" DESC)`,
        );

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'CHK_comments_rating'
            ) THEN
              ALTER TABLE "comments"
              ADD CONSTRAINT "CHK_comments_rating" CHECK ("rating" >= 1 AND "rating" <= 5);
            END IF;
          END
          $$
        `);

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'CHK_comments_source'
            ) THEN
              ALTER TABLE "comments"
              ADD CONSTRAINT "CHK_comments_source" CHECK ("source" IN ('USER', 'ADMIN'));
            END IF;
          END
          $$
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "comments"`);
    }
}
