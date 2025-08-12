import { MigrationInterface, QueryRunner } from 'typeorm';

export class CategoriesKindsAndView1710000003000 implements MigrationInterface {
  name = 'CategoriesKindsAndView1710000003000';

  public async up(q: QueryRunner): Promise<void> {
    // 1) тип категории
    await q.query(`
      ALTER TABLE category
      ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'normal',
      ADD CONSTRAINT category_kind_check
        CHECK (kind IN ('normal','material','collection','popularity'));
    `);

    // 2) индексы
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_category_kind ON category(kind);
      CREATE INDEX IF NOT EXISTS idx_category_name_kind ON category(name, kind);
    `);

    // 3) VIEW v_product_full: нормализованные массивы
    await q.query(`DROP VIEW IF EXISTS v_product_full;`);
    await q.query(`
      CREATE VIEW v_product_full AS
      SELECT
        p.product_id,
        p.sku,
        p.name,
        p.description,
        p.price::numeric(10,2)   AS price,
        p.stock_quantity,
        p.phone_model_id,
        p.view_count,
        p.like_count,
        p.avg_rating::numeric(3,2) AS avg_rating,
        p.created_at,
        p.updated_at,
        COALESCE(json_agg(DISTINCT jsonb_build_object('url', pi.url, 'position', pi.position))
                 FILTER (WHERE pi.product_id IS NOT NULL), '[]'::json) AS images,

        -- Категории обычные
        COALESCE(array_agg(DISTINCT c1.name) FILTER (WHERE c1.kind = 'normal'), ARRAY[]::text[]) AS categories,
        -- Материалы
        COALESCE(array_agg(DISTINCT c2.name) FILTER (WHERE c2.kind = 'material'), ARRAY[]::text[]) AS materials,
        -- Коллекции
        COALESCE(array_agg(DISTINCT c3.name) FILTER (WHERE c3.kind = 'collection'), ARRAY[]::text[]) AS collections,
        -- Популярность
        COALESCE(array_agg(DISTINCT c4.name) FILTER (WHERE c4.kind = 'popularity'), ARRAY[]::text[]) AS popularity
      FROM product p
      LEFT JOIN product_image pi ON pi.product_id = p.product_id
      LEFT JOIN product_category pc ON pc.product_id = p.product_id
      LEFT JOIN category c1 ON c1.category_id = pc.category_id
      LEFT JOIN category c2 ON c2.category_id = pc.category_id
      LEFT JOIN category c3 ON c3.category_id = pc.category_id
      LEFT JOIN category c4 ON c4.category_id = pc.category_id
      GROUP BY p.product_id;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP VIEW IF EXISTS v_product_full;`);
    await q.query(`DROP INDEX IF EXISTS idx_category_name_kind;`);
    await q.query(`DROP INDEX IF EXISTS idx_category_kind;`);
    await q.query(
      `ALTER TABLE category DROP CONSTRAINT IF EXISTS category_kind_check;`,
    );
    await q.query(`ALTER TABLE category DROP COLUMN IF EXISTS kind;`);
  }
}
