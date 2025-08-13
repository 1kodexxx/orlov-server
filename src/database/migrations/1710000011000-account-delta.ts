import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountDelta1710000011000 implements MigrationInterface {
  name = 'AccountDelta1710000011000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      /* 1) Гостевая сессия */
      CREATE TABLE IF NOT EXISTS guest_session (
        id UUID PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_guest_session_last_seen ON guest_session(last_seen);

      /* 2) Поля профиля в customer (если ещё не добавлены) */
      ALTER TABLE customer
        ADD COLUMN IF NOT EXISTS city             VARCHAR(120),
        ADD COLUMN IF NOT EXISTS country          VARCHAR(120),
        ADD COLUMN IF NOT EXISTS home_address     TEXT,
        ADD COLUMN IF NOT EXISTS delivery_address TEXT,
        ADD COLUMN IF NOT EXISTS birth_date       DATE;

      /* 3) Корзина: владелец — либо пользователь, либо гость */
      CREATE TABLE IF NOT EXISTS cart (
        id BIGSERIAL PRIMARY KEY,
        customer_id INT REFERENCES customer(customer_id) ON DELETE CASCADE,
        guest_id    UUID REFERENCES guest_session(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT cart_one_owner_ck CHECK (
          (customer_id IS NOT NULL AND guest_id IS NULL) OR
          (customer_id IS NULL AND guest_id IS NOT NULL)
        )
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_customer
        ON cart(customer_id) WHERE customer_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_guest
        ON cart(guest_id) WHERE guest_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS cart_item (
        id BIGSERIAL PRIMARY KEY,
        cart_id   BIGINT NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
        product_id INT   NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        qty        INT   NOT NULL CHECK (qty > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(cart_id, product_id)
      );

      /* 4) Статусы заказов + updated_at */
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'orders_status_ck'
            AND conrelid = 'orders'::regclass
        ) THEN
          ALTER TABLE orders
            ADD CONSTRAINT orders_status_ck
            CHECK (status IN ('in_transit','completed','cancelled'));
        END IF;
      END $$;

      /* триггер touch для orders.updated_at */
      CREATE OR REPLACE FUNCTION orders_touch_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_orders_touch ON orders;
      CREATE TRIGGER trg_orders_touch
      BEFORE UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION orders_touch_updated_at();
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TRIGGER IF EXISTS trg_orders_touch ON orders;
      DROP FUNCTION IF EXISTS orders_touch_updated_at;

      ALTER TABLE orders
        DROP CONSTRAINT IF EXISTS orders_status_ck;

      ALTER TABLE orders
        DROP COLUMN IF EXISTS updated_at;

      DROP TABLE IF EXISTS cart_item;
      DROP TABLE IF EXISTS cart;

      ALTER TABLE customer
        DROP COLUMN IF EXISTS city,
        DROP COLUMN IF EXISTS country,
        DROP COLUMN IF EXISTS home_address,
        DROP COLUMN IF EXISTS delivery_address,
        DROP COLUMN IF EXISTS birth_date;

      DROP INDEX IF EXISTS idx_guest_session_last_seen;
      DROP TABLE IF EXISTS guest_session;
    `);
  }
}
