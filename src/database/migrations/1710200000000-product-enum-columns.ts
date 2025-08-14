import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductEnumColumns1710200000000 implements MigrationInterface {
  name = 'ProductEnumColumns1710200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      /* 1) Добавляем столбцы (временно NULL), заполним — и потом сделаем NOT NULL */
      ALTER TABLE product
        ADD COLUMN IF NOT EXISTS material   VARCHAR(20),
        ADD COLUMN IF NOT EXISTS popularity VARCHAR(20),
        ADD COLUMN IF NOT EXISTS collection VARCHAR(20);

      /* 2) Попробуем извлечь значения из привязок category (если ранее хранили через product_category) */
      WITH mat AS (
        SELECT p.product_id, MIN(c.name) AS material
          FROM product p
          JOIN product_category pc ON pc.product_id = p.product_id
          JOIN category c ON c.category_id = pc.category_id AND c.kind='material'
         GROUP BY p.product_id
      ), pop AS (
        SELECT p.product_id, MIN(c.name) AS popularity
          FROM product p
          JOIN product_category pc ON pc.product_id = p.product_id
          JOIN category c ON c.category_id = pc.category_id AND c.kind='popularity'
         GROUP BY p.product_id
      ), col AS (
        SELECT p.product_id, MIN(c.name) AS collection
          FROM product p
          JOIN product_category pc ON pc.product_id = p.product_id
          JOIN category c ON c.category_id = pc.category_id AND c.kind='collection'
         GROUP BY p.product_id
      )
      UPDATE product p
         SET material   = COALESCE(p.material,   mat.material),
             popularity = COALESCE(p.popularity,pop.popularity),
             collection = COALESCE(p.collection, col.collection)
        FROM mat
        FULL JOIN pop ON pop.product_id = mat.product_id
        FULL JOIN col ON col.product_id = COALESCE(mat.product_id, pop.product_id)
       WHERE p.product_id = COALESCE(mat.product_id, pop.product_id, col.product_id);

      /* 2.1) Для тех, у кого так и остался NULL — установим дефолты */
      UPDATE product SET material='Кожа'        WHERE material   IS NULL;
      UPDATE product SET popularity='new'       WHERE popularity IS NULL;
      UPDATE product SET collection='business'  WHERE collection IS NULL;

      /* 3) Чек-констрейнты + NOT NULL */
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'product_material_ck' AND conrelid = 'product'::regclass
        ) THEN
          ALTER TABLE product
            ADD CONSTRAINT product_material_ck
            CHECK (material IN ('Кожа', 'Металл', 'Силикон'));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'product_popularity_ck' AND conrelid = 'product'::regclass
        ) THEN
          ALTER TABLE product
            ADD CONSTRAINT product_popularity_ck
            CHECK (popularity IN ('hit','new','recommended'));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'product_collection_ck' AND conrelid = 'product'::regclass
        ) THEN
          ALTER TABLE product
            ADD CONSTRAINT product_collection_ck
            CHECK (collection IN ('business','limited','premium','autumn2025'));
        END IF;
      END $$;

      ALTER TABLE product
        ALTER COLUMN material   SET NOT NULL,
        ALTER COLUMN popularity SET NOT NULL,
        ALTER COLUMN collection SET NOT NULL;

      /* 4) Индексы для быстрых фильтров */
      CREATE INDEX IF NOT EXISTS idx_product_material   ON product(material);
      CREATE INDEX IF NOT EXISTS idx_product_popularity ON product(popularity);
      CREATE INDEX IF NOT EXISTS idx_product_collection ON product(collection);

      /* 5) Пересоздаём вью: DROP + CREATE (во избежание конфликтов по порядку столбцов) */
      DROP VIEW IF EXISTS v_product_full;
      CREATE VIEW v_product_full AS
      SELECT
        p.product_id,
        p.sku,
        p.name,
        p.description,
        p.price::numeric(10,2)     AS price,
        p.stock_quantity,
        p.phone_model_id,
        p.view_count,
        p.like_count,
        p.avg_rating::numeric(3,2) AS avg_rating,
        /* скалярные колонки */
        p.material,
        p.popularity,
        p.collection,
        p.created_at,
        p.updated_at,
        /* картинки */
        COALESCE(
          jsonb_agg(
            jsonb_build_object('url', pi.url, 'position', pi.position)
            ORDER BY pi.position
          ) FILTER (WHERE pi.url IS NOT NULL),
          '[]'::jsonb
        ) AS images,
        /* обычные категории */
        COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.kind = 'normal'), ARRAY[]::text[]) AS categories,
        /* массивы-«обратная совместимость» */
        ARRAY[p.material]   AS materials,
        ARRAY[p.collection] AS collections,
        ARRAY[p.popularity] AS popularity_arr
      FROM product p
      LEFT JOIN product_image   pi ON pi.product_id = p.product_id
      LEFT JOIN product_category pc ON pc.product_id = p.product_id
      LEFT JOIN category        c  ON c.category_id = pc.category_id
      GROUP BY p.product_id;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      /* Откатываем вью — тоже через DROP + CREATE */
      DROP VIEW IF EXISTS v_product_full;
      CREATE VIEW v_product_full AS
      SELECT
        p.product_id,
        p.sku,
        p.name,
        p.description,
        p.price::numeric(10,2)     AS price,
        p.stock_quantity,
        p.phone_model_id,
        p.view_count,
        p.like_count,
        p.avg_rating::numeric(3,2) AS avg_rating,
        p.created_at,
        p.updated_at,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('url', pi.url, 'position', pi.position)
            ORDER BY pi.position
          ) FILTER (WHERE pi.url IS NOT NULL),
          '[]'::jsonb
        ) AS images,
        COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.kind = 'normal'),     ARRAY[]::text[]) AS categories,
        COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.kind = 'material'),   ARRAY[]::text[]) AS materials,
        COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.kind = 'collection'), ARRAY[]::text[]) AS collections,
        COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.kind = 'popularity'), ARRAY[]::text[]) AS popularity
      FROM product p
      LEFT JOIN product_image   pi ON pi.product_id = p.product_id
      LEFT JOIN product_category pc ON pc.product_id = p.product_id
      LEFT JOIN category        c  ON c.category_id = pc.category_id
      GROUP BY p.product_id;

      /* Индексы */
      DROP INDEX IF EXISTS idx_product_material;
      DROP INDEX IF EXISTS idx_product_popularity;
      DROP INDEX IF EXISTS idx_product_collection;

      /* Чеки + колонки */
      ALTER TABLE product DROP CONSTRAINT IF EXISTS product_material_ck;
      ALTER TABLE product DROP CONSTRAINT IF EXISTS product_popularity_ck;
      ALTER TABLE product DROP CONSTRAINT IF EXISTS product_collection_ck;

      ALTER TABLE product
        DROP COLUMN IF EXISTS material,
        DROP COLUMN IF EXISTS popularity,
        DROP COLUMN IF EXISTS collection;
    `);
  }
}
