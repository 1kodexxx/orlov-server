import { MigrationInterface, QueryRunner } from 'typeorm';

export class CategorySlugBackfillUnique1710000004000
  implements MigrationInterface
{
  name = 'CategorySlugBackfillUnique1710000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Заполняем slug для NULL/пустых значений
    // - приводим к нижнему регистру
    // - заменяем пробелы на дефис
    // - чистим повторяющиеся дефисы
    // - обрезаем по краям
    await queryRunner.query(`
      UPDATE category
      SET slug =
        trim(both '-' from
          regexp_replace(
            regexp_replace(lower(coalesce(name, '')), '\\s+', '-', 'g'),
            '-{2,}', '-', 'g'
          )
        )
      WHERE (slug IS NULL OR slug = '')
    `);

    // 2) Разруливаем дубликаты slug (добавляем -2, -3, ... по порядку)
    await queryRunner.query(`
      WITH d AS (
        SELECT
          category_id,
          slug,
          row_number() OVER (PARTITION BY slug ORDER BY category_id) AS rn
        FROM category
      )
      UPDATE category c
      SET slug = c.slug || '-' || d.rn
      FROM d
      WHERE c.category_id = d.category_id
        AND d.rn > 1
    `);

    // 3) Делаем NOT NULL
    await queryRunner.query(`
      ALTER TABLE category
      ALTER COLUMN slug SET NOT NULL
    `);

    // 4) Ставим UNIQUE, если ещё нет
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'category'
            AND c.conname = 'uq_category_slug'
        ) THEN
          ALTER TABLE category
          ADD CONSTRAINT uq_category_slug UNIQUE (slug);
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // снимаем UNIQUE (если есть)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'category'
            AND c.conname = 'uq_category_slug'
        ) THEN
          ALTER TABLE category
          DROP CONSTRAINT uq_category_slug;
        END IF;
      END
      $$;
    `);

    // при откате NOT NULL можно вернуть как было (опционально)
    await queryRunner.query(`
      ALTER TABLE category
      ALTER COLUMN slug DROP NOT NULL
    `);
  }
}
