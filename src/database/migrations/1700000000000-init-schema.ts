// src/database/migrations/1700000000000-init-schema.ts

import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        PERFORM 1 FROM pg_language WHERE lanname = 'plpgsql';
        IF NOT FOUND THEN CREATE LANGUAGE plpgsql; END IF;
      END $$;

      -- 1. phone_model
      CREATE TABLE IF NOT EXISTS phone_model (
        model_id     SERIAL PRIMARY KEY,
        brand        VARCHAR(100) NOT NULL,
        model_name   VARCHAR(100) NOT NULL,
        release_year INT,
        UNIQUE (brand, model_name)
      );

      -- 2. category
      CREATE TABLE IF NOT EXISTS category (
        category_id SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL UNIQUE,
        description TEXT
      );

      -- 3. product
      CREATE TABLE IF NOT EXISTS product (
        product_id     SERIAL PRIMARY KEY,
        sku            VARCHAR(50) NOT NULL UNIQUE,
        name           VARCHAR(200) NOT NULL,
        description    TEXT,
        price          DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        stock_quantity INT NOT NULL CHECK (stock_quantity >= 0),
        phone_model_id INT NOT NULL REFERENCES phone_model(model_id) ON DELETE RESTRICT,
        view_count     BIGINT NOT NULL DEFAULT 0,
        like_count     INT NOT NULL DEFAULT 0,
        avg_rating     DECIMAL(3,2) NOT NULL DEFAULT 0.00
      );

      -- 4. product_category
      CREATE TABLE IF NOT EXISTS product_category (
        product_id  INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        category_id INT NOT NULL REFERENCES category(category_id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, category_id)
      );

      -- 5. customer
      CREATE TABLE IF NOT EXISTS customer (
        customer_id   SERIAL PRIMARY KEY,
        first_name    VARCHAR(100) NOT NULL,
        last_name     VARCHAR(100) NOT NULL,
        email         VARCHAR(200) NOT NULL UNIQUE,
        phone         VARCHAR(20),
        registered_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- 6. address
      CREATE TABLE IF NOT EXISTS address (
        address_id     SERIAL PRIMARY KEY,
        customer_id    INT NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
        line1          VARCHAR(200) NOT NULL,
        line2          VARCHAR(200),
        city           VARCHAR(100) NOT NULL,
        postal_code    VARCHAR(20) NOT NULL,
        country        VARCHAR(100) NOT NULL,
        is_default     BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_address_default_per_customer
        ON address(customer_id) WHERE is_default;

      -- 7. orders
      CREATE TABLE IF NOT EXISTS orders (
        order_id            SERIAL PRIMARY KEY,
        customer_id         INT NOT NULL REFERENCES customer(customer_id),
        order_date          TIMESTAMP NOT NULL DEFAULT NOW(),
        status              VARCHAR(50) NOT NULL,
        shipping_address_id INT REFERENCES address(address_id),
        total_amount        DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0)
      );

      -- 8. order_item
      CREATE TABLE IF NOT EXISTS order_item (
        order_item_id SERIAL PRIMARY KEY,
        order_id      INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        product_id    INT NOT NULL REFERENCES product(product_id),
        quantity      INT NOT NULL CHECK (quantity > 0),
        unit_price    DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
        line_total    DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
      );

      -- 9. payment
      CREATE TABLE IF NOT EXISTS payment (
        payment_id  SERIAL PRIMARY KEY,
        order_id    INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        paid_amount DECIMAL(10,2) NOT NULL CHECK (paid_amount >= 0),
        method      VARCHAR(50) NOT NULL,
        status      VARCHAR(50) NOT NULL,
        paid_at     TIMESTAMP
      );

      -- 10. shipment
      CREATE TABLE IF NOT EXISTS shipment (
        shipment_id      SERIAL PRIMARY KEY,
        order_id         INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        shipped_at       TIMESTAMP,
        carrier          VARCHAR(100),
        tracking_number  VARCHAR(100),
        status           VARCHAR(50)
      );

      -- 11. review (per product per customer)
      CREATE TABLE IF NOT EXISTS review (
        review_id   SERIAL PRIMARY KEY,
        product_id  INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        customer_id INT NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
        rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT,
        review_date TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (product_id, customer_id)
      );

      -- 12. product_like
      CREATE TABLE IF NOT EXISTS product_like (
        product_id  INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        customer_id INT NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
        liked_at    TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (product_id, customer_id)
      );

      -- 13. product_view
      CREATE TABLE IF NOT EXISTS product_view (
        view_id     SERIAL PRIMARY KEY,
        product_id  INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        customer_id INT REFERENCES customer(customer_id),
        viewed_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- 14. comment (threaded)
      CREATE TABLE IF NOT EXISTS comment (
        comment_id        SERIAL PRIMARY KEY,
        product_id        INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        customer_id       INT NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
        parent_comment_id INT REFERENCES comment(comment_id) ON DELETE SET NULL,
        content           TEXT NOT NULL,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- 15. company_review (общие отзывы о компании)
      CREATE TABLE IF NOT EXISTS company_review (
        review_id   SERIAL PRIMARY KEY,
        customer_id INT NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
        rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT NOT NULL,
        review_date TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_company_review_date ON company_review(review_date DESC);
      CREATE INDEX IF NOT EXISTS idx_company_review_customer ON company_review(customer_id);

      -- 16. avg_rating продукта по триггеру
      CREATE OR REPLACE FUNCTION update_product_avg_rating()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP IN ('INSERT','UPDATE') THEN
          UPDATE product p
             SET avg_rating = COALESCE((
               SELECT ROUND(AVG(r.rating)::numeric, 2)
               FROM review r
               WHERE r.product_id = NEW.product_id
             ), 0.00)
           WHERE p.product_id = NEW.product_id;
        END IF;

        IF TG_OP IN ('DELETE','UPDATE') THEN
          IF TG_OP = 'DELETE' OR (TG_OP='UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
            UPDATE product p
               SET avg_rating = COALESCE((
                 SELECT ROUND(AVG(r.rating)::numeric, 2)
                 FROM review r
                 WHERE r.product_id = OLD.product_id
               ), 0.00)
             WHERE p.product_id = OLD.product_id;
          END IF;
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_review_change ON review;
      CREATE TRIGGER trg_review_change
        AFTER INSERT OR UPDATE OR DELETE ON review
        FOR EACH ROW EXECUTE FUNCTION update_product_avg_rating();

      -- 17. like_count
      CREATE OR REPLACE FUNCTION adjust_like_count()
      RETURNS TRIGGER AS $$
      DECLARE pid INT;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          pid := NEW.product_id;
        ELSIF TG_OP = 'DELETE' THEN
          pid := OLD.product_id;
        ELSE
          RETURN NULL;
        END IF;

        UPDATE product
           SET like_count = GREATEST(like_count + CASE WHEN TG_OP='INSERT' THEN 1 ELSE -1 END, 0)
         WHERE product_id = pid;

        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_like_insert ON product_like;
      DROP TRIGGER IF EXISTS trg_like_delete ON product_like;

      CREATE TRIGGER trg_like_insert
        AFTER INSERT ON product_like
        FOR EACH ROW EXECUTE FUNCTION adjust_like_count();

      CREATE TRIGGER trg_like_delete
        AFTER DELETE ON product_like
        FOR EACH ROW EXECUTE FUNCTION adjust_like_count();

      -- запрет UPDATE на product_like
      CREATE OR REPLACE FUNCTION product_like_forbid_update()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'UPDATE on product_like is not allowed. Use DELETE+INSERT instead.';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_like_update_forbid ON product_like;
      CREATE TRIGGER trg_like_update_forbid
        BEFORE UPDATE ON product_like
        FOR EACH ROW EXECUTE FUNCTION product_like_forbid_update();

      -- 18. инкремент view_count
      CREATE OR REPLACE FUNCTION inc_view_count()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE product SET view_count = view_count + 1 WHERE product_id = NEW.product_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_view_insert ON product_view;
      CREATE TRIGGER trg_view_insert
        AFTER INSERT ON product_view
        FOR EACH ROW EXECUTE FUNCTION inc_view_count();

      -- 19. адрес заказа должен принадлежать клиенту
      CREATE OR REPLACE FUNCTION check_order_address_belongs_to_customer()
      RETURNS TRIGGER AS $$
      DECLARE addr_customer_id INT;
      BEGIN
        IF NEW.shipping_address_id IS NULL THEN RETURN NEW; END IF;

        SELECT a.customer_id INTO addr_customer_id FROM address a WHERE a.address_id = NEW.shipping_address_id;
        IF addr_customer_id IS NULL THEN
          RAISE EXCEPTION 'Shipping address % not found', NEW.shipping_address_id;
        END IF;

        IF addr_customer_id <> NEW.customer_id THEN
          RAISE EXCEPTION 'Shipping address % belongs to another customer (%, expected %)',
            NEW.shipping_address_id, addr_customer_id, NEW.customer_id;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_orders_address_check ON orders;
      CREATE TRIGGER trg_orders_address_check
        BEFORE INSERT OR UPDATE OF shipping_address_id, customer_id ON orders
        FOR EACH ROW EXECUTE FUNCTION check_order_address_belongs_to_customer();

      -- 20. пересчёт total_amount заказа
      CREATE OR REPLACE FUNCTION recalc_order_total()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE orders o
           SET total_amount = COALESCE((SELECT SUM(oi.line_total) FROM order_item oi WHERE oi.order_id = o.order_id), 0)
         WHERE o.order_id = COALESCE(NEW.order_id, OLD.order_id);
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_order_item_recalc_insert ON order_item;
      DROP TRIGGER IF EXISTS trg_order_item_recalc_update ON order_item;
      DROP TRIGGER IF EXISTS trg_order_item_recalc_delete ON order_item;

      CREATE TRIGGER trg_order_item_recalc_insert
        AFTER INSERT ON order_item
        FOR EACH ROW EXECUTE FUNCTION recalc_order_total();

      CREATE TRIGGER trg_order_item_recalc_update
        AFTER UPDATE ON order_item
        FOR EACH ROW EXECUTE FUNCTION recalc_order_total();

      CREATE TRIGGER trg_order_item_recalc_delete
        AFTER DELETE ON order_item
        FOR EACH ROW EXECUTE FUNCTION recalc_order_total();

      -- 21. агрегат по отзывам о компании
      CREATE TABLE IF NOT EXISTS company_stats (
        id             SMALLINT PRIMARY KEY CHECK (id = 1),
        avg_rating     DECIMAL(3,2) NOT NULL DEFAULT 0.00,
        review_count   INTEGER      NOT NULL DEFAULT 0,
        last_review_at TIMESTAMP
      );

      INSERT INTO company_stats (id, avg_rating, review_count, last_review_at)
      VALUES (
        1,
        COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM company_review), 0.00),
        COALESCE((SELECT COUNT(*) FROM company_review), 0),
        (SELECT MAX(review_date) FROM company_review)
      )
      ON CONFLICT (id) DO UPDATE SET
        avg_rating     = EXCLUDED.avg_rating,
        review_count   = EXCLUDED.review_count,
        last_review_at = EXCLUDED.last_review_at;

      CREATE OR REPLACE FUNCTION refresh_company_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE company_stats
           SET avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM company_review), 0.00),
               review_count = COALESCE((SELECT COUNT(*) FROM company_review), 0),
               last_review_at = (SELECT MAX(review_date) FROM company_review)
         WHERE id = 1;
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_company_review_stats ON company_review;
      CREATE TRIGGER trg_company_review_stats
        AFTER INSERT OR UPDATE OR DELETE ON company_review
        FOR EACH ROW EXECUTE FUNCTION refresh_company_stats();

      -- 22. индексы на FK
      CREATE INDEX IF NOT EXISTS idx_product_phone_model_id ON product(phone_model_id);
      CREATE INDEX IF NOT EXISTS idx_product_category_category_id ON product_category(category_id);
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_shipping_address ON orders(shipping_address_id);
      CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_item(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_item_product ON order_item(product_id);
      CREATE INDEX IF NOT EXISTS idx_payment_order ON payment(order_id);
      CREATE INDEX IF NOT EXISTS idx_shipment_order ON shipment(order_id);
      CREATE INDEX IF NOT EXISTS idx_review_product ON review(product_id);
      CREATE INDEX IF NOT EXISTS idx_review_customer ON review(customer_id);
      CREATE INDEX IF NOT EXISTS idx_product_like_product ON product_like(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_like_customer ON product_like(customer_id);
      CREATE INDEX IF NOT EXISTS idx_product_view_product ON product_view(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_view_customer ON product_view(customer_id);
      CREATE INDEX IF NOT EXISTS idx_comment_product ON comment(product_id);
      CREATE INDEX IF NOT EXISTS idx_comment_parent ON comment(parent_comment_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_company_review_stats ON company_review;
      DROP FUNCTION IF EXISTS refresh_company_stats;
      DROP TABLE IF EXISTS company_stats;

      DROP TRIGGER IF EXISTS trg_order_item_recalc_insert ON order_item;
      DROP TRIGGER IF EXISTS trg_order_item_recalc_update ON order_item;
      DROP TRIGGER IF EXISTS trg_order_item_recalc_delete ON order_item;
      DROP FUNCTION IF EXISTS recalc_order_total;

      DROP TRIGGER IF EXISTS trg_orders_address_check ON orders;
      DROP FUNCTION IF EXISTS check_order_address_belongs_to_customer;

      DROP TRIGGER IF EXISTS trg_view_insert ON product_view;
      DROP FUNCTION IF EXISTS inc_view_count;

      DROP TRIGGER IF EXISTS trg_like_insert ON product_like;
      DROP TRIGGER IF EXISTS trg_like_delete ON product_like;
      DROP TRIGGER IF EXISTS trg_like_update_forbid ON product_like;
      DROP FUNCTION IF EXISTS product_like_forbid_update;
      DROP FUNCTION IF EXISTS adjust_like_count;

      DROP TRIGGER IF EXISTS trg_review_change ON review;
      DROP FUNCTION IF EXISTS update_product_avg_rating;

      DROP TABLE IF EXISTS comment;
      DROP TABLE IF EXISTS product_view;
      DROP TABLE IF EXISTS product_like;
      DROP TABLE IF EXISTS review;
      DROP TABLE IF EXISTS shipment;
      DROP TABLE IF EXISTS payment;
      DROP TABLE IF EXISTS order_item;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS address;
      DROP TABLE IF EXISTS customer;
      DROP TABLE IF EXISTS product_category;
      DROP TABLE IF EXISTS product;
      DROP TABLE IF EXISTS category;
      DROP TABLE IF EXISTS phone_model;
      DROP TABLE IF EXISTS company_review;
    `);
  }
}
