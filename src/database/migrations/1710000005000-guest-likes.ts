// src/database/migrations/1710000005000-guest-likes.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuestLikes1710000005000 implements MigrationInterface {
  name = 'GuestLikes1710000005000';

  public async up(q: QueryRunner): Promise<void> {
    // 0) если у product_like нет суррогатного PK — добавим
    await q.query(`
      DO $$
      BEGIN
        -- есть ли уже колонка id
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'product_like' AND column_name = 'id'
        ) THEN
          ALTER TABLE product_like ADD COLUMN id BIGSERIAL;
        END IF;

        -- если у таблицы есть какой-то PK — снимем его
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'product_like'::regclass
            AND contype = 'p'
        ) THEN
          -- имя текущего PK
          PERFORM 1;
          EXECUTE (
            SELECT format('ALTER TABLE product_like DROP CONSTRAINT %I', conname)
            FROM pg_constraint
            WHERE conrelid = 'product_like'::regclass AND contype = 'p'
            LIMIT 1
          );
        END IF;

        -- назначим новый PK по id, если его ещё нет
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'product_like'::regclass
            AND contype = 'p'
        ) THEN
          ALTER TABLE product_like ADD CONSTRAINT product_like_pkey PRIMARY KEY (id);
        END IF;
      END$$;
    `);

    // 1) разрешаем NULL в customer_id
    await q.query(
      `ALTER TABLE product_like ALTER COLUMN customer_id DROP NOT NULL`,
    );

    // 2) добавляем visitor_id (если нет)
    await q.query(
      `ALTER TABLE product_like ADD COLUMN IF NOT EXISTS visitor_id uuid`,
    );

    // 3) CHECK-инвариант: владелец либо user, либо visitor (ровно один)
    await q.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'product_like'::regclass
            AND conname = 'product_like_exactly_one_owner'
        ) THEN
          ALTER TABLE product_like
          ADD CONSTRAINT product_like_exactly_one_owner
          CHECK (
            (customer_id IS NOT NULL AND visitor_id IS NULL)
            OR (customer_id IS NULL AND visitor_id IS NOT NULL)
          );
        END IF;
      END$$;
    `);

    // 4) частичный UNIQUE для авторизованных
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_product_like_user
      ON product_like(product_id, customer_id)
      WHERE customer_id IS NOT NULL
    `);

    // 5) частичный UNIQUE для гостей
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_product_like_visitor
      ON product_like(product_id, visitor_id)
      WHERE visitor_id IS NOT NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // убрать частичные индексы и чек
    await q.query(`DROP INDEX IF EXISTS ux_product_like_visitor`);
    await q.query(`DROP INDEX IF EXISTS ux_product_like_user`);
    await q.query(
      `ALTER TABLE product_like DROP CONSTRAINT IF EXISTS product_like_exactly_one_owner`,
    );

    // попытаться вернуть старую схему: customer_id NOT NULL и композитный PK
    // 1) снять PK по id
    await q.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'product_like'::regclass AND contype = 'p'
        ) THEN
          EXECUTE (
            SELECT format('ALTER TABLE product_like DROP CONSTRAINT %I', conname)
            FROM pg_constraint
            WHERE conrelid = 'product_like'::regclass AND contype = 'p'
            LIMIT 1
          );
        END IF;
      END$$;
    `);

    // 2) вернуть NOT NULL
    await q.query(
      `ALTER TABLE product_like ALTER COLUMN customer_id SET NOT NULL`,
    );

    // 3) удалить visitor_id
    await q.query(`ALTER TABLE product_like DROP COLUMN IF EXISTS visitor_id`);

    // 4) восстановить старый композитный PK (product_id, customer_id)
    await q.query(
      `ALTER TABLE product_like ADD CONSTRAINT product_like_pkey PRIMARY KEY (product_id, customer_id)`,
    );

    // 5) при желании можно удалить колонку id (необязательно)
    await q.query(`ALTER TABLE product_like DROP COLUMN IF EXISTS id`);
  }
}
