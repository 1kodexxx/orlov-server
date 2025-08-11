// src/database/migrations/170000000008-seed-products-and-comments.ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedProducts } from '../seed/seed-products';
import { seedProductComments } from '../seed/seed-product-comments';

export class SeedProductsAndComments1710000000000
  implements MigrationInterface
{
  name = 'SeedProductsAndComments1710000000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.startTransaction();
    try {
      // 0) product_image — на всякий случай
      await qr.query(`
        CREATE TABLE IF NOT EXISTS public.product_image (
          product_id  INTEGER NOT NULL REFERENCES public.product(product_id) ON DELETE CASCADE,
          url         TEXT    NOT NULL,
          position    INTEGER NOT NULL DEFAULT 0,
          CONSTRAINT uq_product_image_product_url UNIQUE (product_id, url)
        );
        CREATE INDEX IF NOT EXISTS idx_product_image_product_id
          ON public.product_image (product_id);
      `);

      // 1) phone_model: определяем колонки
      const pkRow: Array<{ column_name: string }> = await qr.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'phone_model'
          AND column_name IN ('model_id','id','phone_model_id')
        ORDER BY CASE WHEN column_name='model_id' THEN 0 WHEN column_name='id' THEN 1 ELSE 2 END
        LIMIT 1;
      `);
      if (!pkRow.length)
        throw new Error(
          'phone_model: PK не найден (ожидались model_id|id|phone_model_id)',
        );
      const phoneModelPk = pkRow[0].column_name;

      const nameRow: Array<{ column_name: string }> = await qr.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='phone_model'
          AND column_name IN ('model_name','name')
        ORDER BY CASE WHEN column_name='model_name' THEN 0 ELSE 1 END
        LIMIT 1;
      `);
      const nameCol = nameRow[0]?.column_name ?? 'model_name';

      const cols: Array<{ column_name: string }> = await qr.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='phone_model'
      `);
      const hasBrand = cols.some((c) => c.column_name === 'brand');
      const hasYear = cols.some((c) => c.column_name === 'release_year');

      const fields = [phoneModelPk, nameCol];
      const values = ['1', `'Default model'`];
      if (hasBrand) {
        fields.splice(1, 0, 'brand');
        values.splice(1, 0, `'Generic'`);
      }
      if (hasYear) {
        fields.push('release_year');
        values.push('NULL');
      }

      await qr.query(`
        INSERT INTO phone_model (${fields.join(', ')})
        VALUES (${values.join(', ')})
        ON CONFLICT (${phoneModelPk}) DO NOTHING;
      `);

      // 2) продукты
      const insertProductSql = `
        INSERT INTO product
          (product_id, sku, name, description, price,
           stock_quantity, phone_model_id, view_count, like_count, avg_rating)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (product_id) DO NOTHING
      `;

      for (const p of seedProducts) {
        await qr.query(insertProductSql, [
          p.id,
          p.slug,
          p.name,
          p.description,
          p.price,
          0, // stock_quantity
          1, // phone_model_id — дефолт
          (p as any).views ?? 0,
          (p as any).likes ?? 0,
          (p as any).avgRating ?? 0,
        ]);

        // картинки
        for (let i = 0; i < p.images.length; i++) {
          await qr.query(
            `INSERT INTO product_image (product_id, url, position)
             VALUES ($1,$2,$3)
             ON CONFLICT ON CONSTRAINT uq_product_image_product_url DO NOTHING`,
            [p.id, p.images[i], i + 1],
          );
        }

        // категории
        for (const name of p.categories) {
          const slug = name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9а-яё-]/giu, '');
          const ins = await qr.query(
            `INSERT INTO category (name, slug)
             VALUES ($1,$2)
             ON CONFLICT (name) DO NOTHING
             RETURNING category_id`,
            [name, slug],
          );
          let categoryId = ins?.[0]?.category_id ?? null;
          if (!categoryId) {
            const row = await qr.query(
              `SELECT category_id FROM category WHERE name=$1 LIMIT 1`,
              [name],
            );
            categoryId = row?.[0]?.category_id ?? null;
          }
          if (categoryId) {
            await qr.query(
              `INSERT INTO product_category (product_id, category_id)
               VALUES ($1,$2)
               ON CONFLICT DO NOTHING`,
              [p.id, categoryId],
            );
          }
        }
      }

      // 3) комменты — только если есть customer
      let cid: number | null = null;
      try {
        const r = await qr.query(
          `SELECT customer_id FROM customer ORDER BY customer_id ASC LIMIT 1`,
        );
        cid = r?.[0]?.customer_id ?? null;
      } catch {
        cid = null;
      }

      if (cid) {
        for (const c of seedProductComments) {
          await qr.query(
            `INSERT INTO comment (product_id, customer_id, parent_comment_id, content, created_at)
             VALUES ($1,$2,NULL,$3,$4)
             ON CONFLICT DO NOTHING`,
            [c.productId, cid, c.text, c.createdAt],
          );
        }
      }

      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    }
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.startTransaction();
    try {
      await qr.query(`DELETE FROM comment;`).catch(() => {});
      await qr.query(`DELETE FROM product_image;`).catch(() => {});
      await qr.query(`DELETE FROM product_category;`).catch(() => {});
      await qr.query(`DELETE FROM product;`).catch(() => {});
      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    }
  }
}
