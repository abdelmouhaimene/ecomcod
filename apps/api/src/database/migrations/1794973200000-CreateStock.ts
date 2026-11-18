import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Production schema for the stock module. Safe to run on a fresh or partially
 * synchronized database: tables, columns and indexes use IF NOT EXISTS and
 * constraints are added through DO blocks because Postgres has no
 * ADD CONSTRAINT IF NOT EXISTS.
 */
export class CreateStock1794973200000 implements MigrationInterface {
    name = 'CreateStock1794973200000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "products"
            ADD COLUMN IF NOT EXISTS "quantity" integer NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "PMP" numeric(12,2) NOT NULL DEFAULT 0
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "suppliers" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "name" character varying(150) NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_suppliers" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "stock_entries" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "date" date NOT NULL,
            "supplierId" uuid NOT NULL,
            "adminId" uuid NOT NULL,
            "total" numeric(12,2) NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_stock_entries" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "stock_entry_items" (
            "id" uuid NOT NULL DEFAULT gen_random_uuid(),
            "entryId" uuid NOT NULL,
            "productId" uuid NOT NULL,
            "quantity" integer NOT NULL,
            "unitPrice" numeric(12,2) NOT NULL,
            "lineTotal" numeric(12,2) NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "PK_stock_entry_items" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_suppliers_name" ON "suppliers" ("name")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_entries_date" ON "stock_entries" ("date")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_entries_supplier" ON "stock_entries" ("supplierId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_entries_admin" ON "stock_entries" ("adminId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_entry_items_entry" ON "stock_entry_items" ("entryId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_stock_entry_items_product" ON "stock_entry_items" ("productId")
        `);

        const checks: Array<[string, string, string]> = [
            ['CHK_products_stock', 'products', '"quantity" >= 0 AND "PMP" >= 0'],
            ['CHK_stock_entry_items_quantity', 'stock_entry_items', '"quantity" > 0'],
            ['CHK_stock_entry_items_unit_price', 'stock_entry_items', '"unitPrice" >= 0'],
        ];
        for (const [name, table, expression] of checks) {
            await queryRunner.query(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = '${name}' AND conrelid = '${table}'::regclass
                ) THEN
                  ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expression});
                END IF;
              END $$
            `);
        }

        const foreignKeys: Array<[string, string, string, string, string, string]> = [
            ['FK_stock_entries_supplier', 'stock_entries', 'supplierId', 'suppliers', 'id', 'RESTRICT'],
            ['FK_stock_entries_admin', 'stock_entries', 'adminId', 'admins', 'id', 'RESTRICT'],
            ['FK_stock_entry_items_entry', 'stock_entry_items', 'entryId', 'stock_entries', 'id', 'CASCADE'],
            ['FK_stock_entry_items_product', 'stock_entry_items', 'productId', 'products', 'id', 'RESTRICT'],
        ];
        for (const [name, table, column, referencedTable, referencedColumn, onDelete] of foreignKeys) {
            await queryRunner.query(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = '${name}' AND conrelid = '${table}'::regclass
                ) AND to_regclass('${referencedTable}') IS NOT NULL THEN
                  ALTER TABLE "${table}"
                    ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}")
                    REFERENCES "${referencedTable}" ("${referencedColumn}") ON DELETE ${onDelete};
                END IF;
              END $$
            `);
        }
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          DROP TABLE IF EXISTS "stock_entry_items", "stock_entries", "suppliers" CASCADE
        `);
        await queryRunner.query(`
          ALTER TABLE "products"
            DROP COLUMN IF EXISTS "PMP",
            DROP COLUMN IF EXISTS "quantity"
        `);
    }
}
