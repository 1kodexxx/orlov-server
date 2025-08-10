// src/database/migrations/1700000000007-add-category-extra-columns.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryExtraColumns1700000000007
  implements MigrationInterface
{
  name = 'AddCategoryExtraColumns1700000000007';

  public async up(qr: QueryRunner): Promise<void> {
    // 1) slug
    await qr.query(`
      ALTER TABLE "category"
      ADD COLUMN IF NOT EXISTS "slug" varchar(150)
    `);

    // уникальный индекс по slug (lower)
    await qr.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ux_category_slug'
  ) THEN
    CREATE UNIQUE INDEX ux_category_slug ON "category" (lower("slug"));
  END IF;
END $$;
    `);

    // 2) created_at
    await qr.query(`
      ALTER TABLE "category"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now()
    `);

    // 3) parent_id + FK на саму себя
    await qr.query(`
      ALTER TABLE "category"
      ADD COLUMN IF NOT EXISTS "parent_id" integer
    `);

    await qr.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_category_parent'
      AND table_name = 'category'
  ) THEN
    ALTER TABLE "category"
      ADD CONSTRAINT fk_category_parent
      FOREIGN KEY ("parent_id") REFERENCES "category" ("category_id")
      ON DELETE SET NULL;
  END IF;
END $$;
    `);

    // индекс на parent_id
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_category_parent ON "category" ("parent_id")
    `);

    // 4) автозаполнение slug для уже существующих записей
    await qr.query(`
      UPDATE "category"
      SET "slug" = lower(regexp_replace("name", '\\s+', '-', 'g'))
      WHERE ("slug" IS NULL OR "slug" = '')
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS idx_category_parent`);
    await qr.query(
      `ALTER TABLE "category" DROP CONSTRAINT IF EXISTS fk_category_parent`,
    );
    await qr.query(`DROP INDEX IF EXISTS ux_category_slug`);
    await qr.query(`ALTER TABLE "category" DROP COLUMN IF EXISTS "parent_id"`);
    await qr.query(`ALTER TABLE "category" DROP COLUMN IF EXISTS "created_at"`);
    await qr.query(`ALTER TABLE "category" DROP COLUMN IF EXISTS "slug"`);
  }
}
