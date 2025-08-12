// src/database/migrations/1710000006000-product-view-visitor-and-guard.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductViewVisitorAndGuard1710000006000
  implements MigrationInterface
{
  name = 'ProductViewVisitorAndGuard1710000006000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE product_view ADD COLUMN IF NOT EXISTS visitor_id uuid`,
    );
    // унифицируем "ключ владельца": customer_id или заглушка -1; visitor_id или нулевой uuid
    await q.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'ux_product_view_daily_guard'
        ) THEN
          CREATE UNIQUE INDEX ux_product_view_daily_guard
            ON product_view(
              product_id,
              date_trunc('day', created_at),
              COALESCE(customer_id, -1),
              COALESCE(visitor_id, '00000000-0000-0000-0000-000000000000'::uuid)
            );
        END IF;
      END$$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS ux_product_view_daily_guard`);
    // колонку visitor_id оставим — безвредно для даунгрейда
  }
}
