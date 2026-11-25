import { MigrationInterface, QueryRunner } from 'typeorm';

/** Admin-managed FAQ entries and policy articles shown on the storefront. */
export class CreateFaqAndPolicy1795550000000 implements MigrationInterface {
    name = 'CreateFaqAndPolicy1795550000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "faq_items" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "question" text NOT NULL,
            "answer" text NOT NULL,
            "position" integer NOT NULL DEFAULT 0,
            "isActive" boolean NOT NULL DEFAULT true,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_faq_items" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'CHK_faq_items_position'
            ) THEN
              ALTER TABLE "faq_items"
              ADD CONSTRAINT "CHK_faq_items_position" CHECK ("position" >= 0);
            END IF;
          END $$;
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_faq_items_active_position"
          ON "faq_items" ("isActive", "position")
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "policy_articles" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "title" text NOT NULL,
            "body" text NOT NULL,
            "position" integer NOT NULL DEFAULT 0,
            "isActive" boolean NOT NULL DEFAULT true,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_policy_articles" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'CHK_policy_articles_position'
            ) THEN
              ALTER TABLE "policy_articles"
              ADD CONSTRAINT "CHK_policy_articles_position" CHECK ("position" >= 0);
            END IF;
          END $$;
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_policy_articles_active_position"
          ON "policy_articles" ("isActive", "position")
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "policy_articles"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "faq_items"`);
    }
}
