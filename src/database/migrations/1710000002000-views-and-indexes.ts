import { MigrationInterface, QueryRunner } from 'typeorm';

export class ViewsAndIndexes1710000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      ALTER TABLE product_view
        ADD COLUMN IF NOT EXISTS visitor_id TEXT,
        ADD COLUMN IF NOT EXISTS user_agent TEXT,
        ADD COLUMN IF NOT EXISTS ip INET,
        ADD COLUMN IF NOT EXISTS viewed_date DATE;

      -- Заполняем viewed_date для уже существующих записей
      UPDATE product_view
      SET viewed_date = viewed_at::date
      WHERE viewed_date IS NULL;

      -- Создаём триггер, чтобы при вставке автоматически проставлялась viewed_date
      CREATE OR REPLACE FUNCTION set_viewed_date()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.viewed_date := NEW.viewed_at::date;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_set_viewed_date ON product_view;
      CREATE TRIGGER trg_set_viewed_date
      BEFORE INSERT ON product_view
      FOR EACH ROW
      EXECUTE FUNCTION set_viewed_date();

      -- один просмотр в сутки для связки (product + user|visitor)
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE indexname = 'ux_product_view_daily_guard'
        ) THEN
          CREATE UNIQUE INDEX ux_product_view_daily_guard
          ON product_view(
            product_id,
            COALESCE(customer_id, -1),
            COALESCE(visitor_id, ''),
            viewed_date
          );
        END IF;
      END $$;

      -- индексы под фильтры/поиск/сортировки
      CREATE INDEX IF NOT EXISTS idx_product_name_trgm ON product USING GIN (name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_product_price ON product(price);
      CREATE INDEX IF NOT EXISTS idx_product_created_at ON product(created_at);
      CREATE INDEX IF NOT EXISTS idx_product_avg_rating ON product(avg_rating);
      CREATE INDEX IF NOT EXISTS idx_product_like_count ON product(like_count);
      CREATE INDEX IF NOT EXISTS idx_product_view_count ON product(view_count);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS ux_product_view_daily_guard;
      DROP INDEX IF EXISTS idx_product_name_trgm;
      DROP INDEX IF EXISTS idx_product_price;
      DROP INDEX IF EXISTS idx_product_created_at;
      DROP INDEX IF EXISTS idx_product_avg_rating;
      DROP INDEX IF EXISTS idx_product_like_count;
      DROP INDEX IF EXISTS idx_product_view_count;

      DROP TRIGGER IF EXISTS trg_set_viewed_date ON product_view;
      DROP FUNCTION IF EXISTS set_viewed_date;

      ALTER TABLE product_view
        DROP COLUMN IF EXISTS viewed_date,
        DROP COLUMN IF EXISTS visitor_id,
        DROP COLUMN IF EXISTS user_agent,
        DROP COLUMN IF EXISTS ip;
    `);
  }
}
