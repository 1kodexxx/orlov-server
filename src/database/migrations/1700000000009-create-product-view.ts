// src/database/migrations/1700000000009-create-product-view.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductView1700000000009 implements MigrationInterface {
  name = 'CreateProductView1700000000009';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE OR REPLACE VIEW v_product_full AS
      SELECT
        p.product_id,
        p.sku,
        p.name,
        p.description,
        p.price,
        p.stock_quantity,
        p.phone_model_id,
        p.view_count,
        p.like_count,
        p.avg_rating,
        p.created_at,
        p.updated_at,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('url', pi.url, 'position', pi.position)
            ORDER BY pi.position
          ) FILTER (WHERE pi.url IS NOT NULL),
          '[]'::jsonb
        ) AS images,
        COALESCE(
          array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL),
          ARRAY[]::text[]
        ) AS categories
      FROM product p
      LEFT JOIN product_image pi ON pi.product_id = p.product_id
      LEFT JOIN product_category pc ON pc.product_id = p.product_id
      LEFT JOIN category c ON c.category_id = pc.category_id
      GROUP BY p.product_id;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP VIEW IF EXISTS v_product_full;`);
  }
}
