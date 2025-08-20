import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSquashedWithPhone1723706000000
  implements MigrationInterface
{
  name = 'BaselineSquashedWithPhone1723706000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      /* =========================
         0) prerequisites
      ========================== */
      DO $$ BEGIN
        PERFORM 1 FROM pg_language WHERE lanname = 'plpgsql';
        IF NOT FOUND THEN CREATE LANGUAGE plpgsql; END IF;
      END $$;

      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      /* =========================
         1) core tables
      ========================== */

      CREATE TABLE IF NOT EXISTS phone_model (
        model_id     SERIAL PRIMARY KEY,
        brand        VARCHAR(100) NOT NULL,
        model_name   VARCHAR(100) NOT NULL,
        release_year INT,
        UNIQUE (brand, model_name)
      );

      CREATE TABLE IF NOT EXISTS category (
        category_id SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        slug        VARCHAR(150) NOT NULL,
        kind        TEXT NOT NULL DEFAULT 'normal',
        created_at  timestamptz DEFAULT now(),
        parent_id   integer,
        CONSTRAINT fk_category_parent
          FOREIGN KEY (parent_id) REFERENCES category(category_id) ON DELETE SET NULL,
        CONSTRAINT category_kind_check
          CHECK (kind IN ('normal','material','collection','popularity'))
      );

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'category' AND c.conname = 'uq_category_slug'
        ) THEN
          ALTER TABLE category
          ADD CONSTRAINT uq_category_slug UNIQUE (slug);
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS ux_category_slug_lower ON category (lower(slug));
      CREATE INDEX IF NOT EXISTS idx_category_parent     ON category(parent_id);
      CREATE INDEX IF NOT EXISTS idx_category_kind       ON category(kind);
      CREATE INDEX IF NOT EXISTS idx_category_name_kind  ON category(name, kind);

      CREATE TABLE IF NOT EXISTS customer (
        customer_id       SERIAL PRIMARY KEY,
        first_name        VARCHAR(100) NOT NULL,
        last_name         VARCHAR(100) NOT NULL,
        email             VARCHAR(200) NOT NULL UNIQUE,
        phone             VARCHAR(20),
        registered_at     timestamptz NOT NULL DEFAULT now(),
        password_hash     TEXT        NOT NULL DEFAULT '',
        role              VARCHAR(20) NOT NULL DEFAULT 'customer',
        avatar_url        VARCHAR(500),
        avatar_updated_at timestamptz,
        token_version     INTEGER     NOT NULL DEFAULT 0,
        headline          VARCHAR(200),
        organization      VARCHAR(200)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_email ON customer (lower(email));

      ALTER TABLE customer
        ADD COLUMN IF NOT EXISTS city             VARCHAR(120),
        ADD COLUMN IF NOT EXISTS country          VARCHAR(120),
        ADD COLUMN IF NOT EXISTS home_address     TEXT,
        ADD COLUMN IF NOT EXISTS delivery_address TEXT,
        ADD COLUMN IF NOT EXISTS birth_date       DATE,
        ADD COLUMN IF NOT EXISTS pickup_point     VARCHAR(200);

      /* =========================
         1.a) PHONE: нормализация/дедуп/ограничения/уникальность
      ========================== */

      /* Нормализуем существующие телефоны в формат +7XXXXXXXXXX */
      WITH src AS (
        SELECT
          customer_id,
          phone,
          regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') AS d
        FROM customer
      ),
      normed AS (
        SELECT
          customer_id,
          CASE
            WHEN d IS NULL OR d = ''            THEN NULL
            WHEN phone ~ '^\\+7\\d{10}$'        THEN phone
            WHEN d ~ '^8\\d{10}$'               THEN '+7' || substr(d, 2, 10)
            WHEN d ~ '^7\\d{10}$'               THEN '+7' || substr(d, 2, 10)
            WHEN d ~ '^\\d{10}$'                THEN '+7' || d
            ELSE NULL
          END AS norm
        FROM src
      )
      UPDATE customer c
         SET phone = n.norm
      FROM normed n
      WHERE n.customer_id = c.customer_id
        AND (n.norm IS DISTINCT FROM c.phone);

      /* Удалим дубликаты телефонов: у «лишних» строк phone -> NULL (оставим самую раннюю регистрацию) */
      WITH ranked AS (
        SELECT
          customer_id,
          phone,
          ROW_NUMBER() OVER (PARTITION BY phone ORDER BY registered_at ASC, customer_id ASC) AS rn
        FROM customer
        WHERE phone IS NOT NULL
      )
      UPDATE customer c
         SET phone = NULL
      FROM ranked r
      WHERE r.customer_id = c.customer_id
        AND r.phone IS NOT NULL
        AND r.rn > 1;

      /* CHECK: либо NULL, либо +7XXXXXXXXXX */
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'customer_phone_format_ck'
            AND conrelid = 'customer'::regclass
        ) THEN
          ALTER TABLE customer
            ADD CONSTRAINT customer_phone_format_ck
            CHECK (phone IS NULL OR phone ~ '^\\+7\\d{10}$');
        END IF;
      END $$;

      /* UNIQUE индекс только для NOT NULL телефонов */
      CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_phone_ru
        ON customer (phone) WHERE phone IS NOT NULL;

      /* =========================
         1.b) Прочие core таблицы
      ========================== */

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

      CREATE TABLE IF NOT EXISTS product (
        product_id     SERIAL PRIMARY KEY,
        sku            VARCHAR(50)  NOT NULL UNIQUE,
        name           VARCHAR(200) NOT NULL,
        description    TEXT,
        price          DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
        phone_model_id INT NOT NULL REFERENCES phone_model(model_id) ON DELETE RESTRICT,
        view_count     BIGINT NOT NULL DEFAULT 0,
        like_count     INT    NOT NULL DEFAULT 0,
        avg_rating     DECIMAL(3,2) NOT NULL DEFAULT 0.00,
        /* enum-like scalar filters */
        material       VARCHAR(20),
        popularity     VARCHAR(20),
        collection     VARCHAR(20),
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS product_image (
        product_id  INTEGER NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        url         TEXT    NOT NULL,
        position    INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT uq_product_image_product_url UNIQUE (product_id, url)
      );
      CREATE INDEX IF NOT EXISTS idx_product_image_product_id ON product_image(product_id);

      CREATE TABLE IF NOT EXISTS product_category (
        product_id  INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        category_id INT NOT NULL REFERENCES category(category_id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, category_id)
      );

      CREATE TABLE IF NOT EXISTS orders (
        order_id            SERIAL PRIMARY KEY,
        customer_id         INT NOT NULL REFERENCES customer(customer_id),
        order_date          timestamptz NOT NULL DEFAULT now(),
        status              VARCHAR(50) NOT NULL,
        shipping_address_id INT REFERENCES address(address_id),
        total_amount        DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
        updated_at          timestamptz NOT NULL DEFAULT now()
      );

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

      CREATE TABLE IF NOT EXISTS order_item (
        order_item_id SERIAL PRIMARY KEY,
        order_id      INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        product_id    INT NOT NULL REFERENCES product(product_id),
        quantity      INT NOT NULL CHECK (quantity > 0),
        unit_price    DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
        line_total    DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
      );

      CREATE TABLE IF NOT EXISTS payment (
        payment_id  SERIAL PRIMARY KEY,
        order_id    INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        paid_amount DECIMAL(10,2) NOT NULL CHECK (paid_amount >= 0),
        method      VARCHAR(50) NOT NULL,
        status      VARCHAR(50) NOT NULL,
        paid_at     timestamptz
      );

      CREATE TABLE IF NOT EXISTS shipment (
        shipment_id      SERIAL PRIMARY KEY,
        order_id         INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        shipped_at       timestamptz,
        carrier          VARCHAR(100),
        tracking_number  VARCHAR(100),
        status           VARCHAR(50)
      );

      /* -------- reviews (товар) — пользователи и гости -------- */
      CREATE TABLE IF NOT EXISTS review (
        review_id   SERIAL PRIMARY KEY,
        product_id  INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        customer_id INT REFERENCES customer(customer_id) ON DELETE CASCADE,
        visitor_id  uuid,
        rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT,
        review_date timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT review_exactly_one_owner
          CHECK (
            (customer_id IS NOT NULL AND visitor_id IS NULL) OR
            (customer_id IS NULL AND visitor_id IS NOT NULL)
          )
      );

      /* -------- likes — пользователи и гости -------- */
      CREATE TABLE IF NOT EXISTS product_like (
        id          BIGSERIAL PRIMARY KEY,
        product_id  INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        customer_id INT REFERENCES customer(customer_id) ON DELETE CASCADE,
        visitor_id  uuid,
        liked_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT product_like_exactly_one_owner
          CHECK (
            (customer_id IS NOT NULL AND visitor_id IS NULL)
            OR (customer_id IS NULL AND visitor_id IS NOT NULL)
          )
      );

      /* -------- избранное -------- */
      CREATE TABLE IF NOT EXISTS product_favorite (
        id          BIGSERIAL PRIMARY KEY,
        product_id  INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        customer_id INT REFERENCES customer(customer_id) ON DELETE CASCADE,
        visitor_id  uuid,
        added_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT product_favorite_exactly_one_owner
          CHECK (
            (customer_id IS NOT NULL AND visitor_id IS NULL)
            OR (customer_id IS NULL AND visitor_id IS NOT NULL)
          )
      );

      /* -------- просмотры -------- */
      CREATE TABLE IF NOT EXISTS product_view (
        view_id     SERIAL PRIMARY KEY,
        product_id  INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        customer_id INT REFERENCES customer(customer_id),
        visitor_id  uuid,
        user_agent  TEXT,
        ip          INET,
        viewed_at   timestamptz NOT NULL DEFAULT now(),
        viewed_date DATE
      );

      /* -------- комментарии -------- */
      CREATE TABLE IF NOT EXISTS comment (
        comment_id        SERIAL PRIMARY KEY,
        product_id        INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        customer_id       INT NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
        parent_comment_id INT REFERENCES comment(comment_id) ON DELETE SET NULL,
        content           TEXT NOT NULL,
        created_at        timestamptz NOT NULL DEFAULT now()
      );

      /* -------- отзывы о компании -------- */
      CREATE TABLE IF NOT EXISTS company_reviews (
        id           BIGSERIAL PRIMARY KEY,
        customer_id  INTEGER NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
        rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        text         TEXT NOT NULL,
        is_approved  BOOLEAN NOT NULL DEFAULT false,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      );

      /* -------- гости и корзина -------- */
      CREATE TABLE IF NOT EXISTS guest_session (
        id UUID PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

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

      CREATE TABLE IF NOT EXISTS cart_item (
        id BIGSERIAL PRIMARY KEY,
        cart_id    BIGINT NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
        product_id INT    NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
        qty        INT    NOT NULL CHECK (qty > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(cart_id, product_id)
      );

      /* =========================
         2) indexes
      ========================== */
      CREATE INDEX IF NOT EXISTS idx_product_phone_model_id       ON product(phone_model_id);
      CREATE INDEX IF NOT EXISTS idx_product_category_category_id ON product_category(category_id);
      CREATE INDEX IF NOT EXISTS idx_orders_customer              ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_shipping_address      ON orders(shipping_address_id);
      CREATE INDEX IF NOT EXISTS idx_order_item_order             ON order_item(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_item_product           ON order_item(product_id);
      CREATE INDEX IF NOT EXISTS idx_payment_order                ON payment(order_id);
      CREATE INDEX IF NOT EXISTS idx_shipment_order               ON shipment(order_id);

      CREATE INDEX IF NOT EXISTS idx_review_product               ON review(product_id);
      CREATE INDEX IF NOT EXISTS idx_review_customer              ON review(customer_id);
      CREATE INDEX IF NOT EXISTS idx_review_visitor               ON review(visitor_id);

      CREATE INDEX IF NOT EXISTS idx_product_like_product         ON product_like(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_like_customer        ON product_like(customer_id);
      CREATE INDEX IF NOT EXISTS idx_product_like_visitor         ON product_like(visitor_id);

      CREATE INDEX IF NOT EXISTS idx_product_favorite_product     ON product_favorite(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_favorite_customer    ON product_favorite(customer_id);
      CREATE INDEX IF NOT EXISTS idx_product_favorite_visitor     ON product_favorite(visitor_id);

      CREATE INDEX IF NOT EXISTS idx_product_view_product         ON product_view(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_view_customer        ON product_view(customer_id);
      CREATE INDEX IF NOT EXISTS idx_product_view_visitor         ON product_view(visitor_id);

      CREATE INDEX IF NOT EXISTS idx_comment_product              ON comment(product_id);
      CREATE INDEX IF NOT EXISTS idx_comment_parent               ON comment(parent_comment_id);

      /* поиск/сортировка каталога */
      CREATE INDEX IF NOT EXISTS idx_product_name_trgm    ON product USING GIN (name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_product_price        ON product(price);
      CREATE INDEX IF NOT EXISTS idx_product_created_at   ON product(created_at);
      CREATE INDEX IF NOT EXISTS idx_product_avg_rating   ON product(avg_rating);
      CREATE INDEX IF NOT EXISTS idx_product_like_count   ON product(like_count);
      CREATE INDEX IF NOT EXISTS idx_product_view_count   ON product(view_count);

      /* фильтры */
      CREATE INDEX IF NOT EXISTS idx_product_material     ON product(material);
      CREATE INDEX IF NOT EXISTS idx_product_popularity   ON product(popularity);
      CREATE INDEX IF NOT EXISTS idx_product_collection   ON product(collection);

      CREATE INDEX IF NOT EXISTS idx_guest_session_last_seen ON guest_session(last_seen);

      /* company_reviews — индексы (для полноты и симметрии с down) */
      CREATE INDEX IF NOT EXISTS idx_company_reviews_customer   ON company_reviews(customer_id);
      CREATE INDEX IF NOT EXISTS idx_company_reviews_is_approved ON company_reviews(is_approved);
      CREATE INDEX IF NOT EXISTS idx_company_reviews_created_at ON company_reviews(created_at);

      /* уникальности (единые имена) */
      CREATE UNIQUE INDEX IF NOT EXISTS uq_review_product_customer
        ON review(product_id, customer_id) WHERE customer_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_review_product_visitor
        ON review(product_id, visitor_id) WHERE visitor_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_product_view_daily
        ON product_view (
          product_id,
          COALESCE(customer_id, -1),
          COALESCE(visitor_id, '00000000-0000-0000-0000-000000000000'::uuid),
          viewed_date
        );

      /* =========================
         3) functions & triggers
      ========================== */

      CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_product_touch BEFORE UPDATE ON product
        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
      CREATE TRIGGER trg_company_reviews_touch BEFORE UPDATE ON company_reviews
        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

      CREATE OR REPLACE FUNCTION update_product_avg_rating()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE product p
           SET avg_rating = COALESCE((
             SELECT ROUND(AVG(r.rating)::numeric, 2)
             FROM review r
             WHERE r.product_id = COALESCE(NEW.product_id, OLD.product_id)
           ), 0.00)
         WHERE p.product_id = COALESCE(NEW.product_id, OLD.product_id);
        RETURN COALESCE(NEW, OLD);
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_review_change
        AFTER INSERT OR UPDATE OR DELETE ON review
        FOR EACH ROW EXECUTE FUNCTION update_product_avg_rating();

      CREATE OR REPLACE FUNCTION adjust_like_count()
      RETURNS TRIGGER AS $$
      DECLARE pid INT;
      BEGIN
        IF TG_OP = 'INSERT' THEN pid := NEW.product_id;
        ELSIF TG_OP = 'DELETE' THEN pid := OLD.product_id;
        ELSE RETURN NULL; END IF;
        UPDATE product
           SET like_count = GREATEST(like_count + CASE WHEN TG_OP='INSERT' THEN 1 ELSE -1 END, 0)
         WHERE product_id = pid;
        RETURN COALESCE(NEW, OLD);
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_like_insert AFTER INSERT ON product_like
        FOR EACH ROW EXECUTE FUNCTION adjust_like_count();
      CREATE TRIGGER trg_like_delete AFTER DELETE ON product_like
        FOR EACH ROW EXECUTE FUNCTION adjust_like_count();

      CREATE OR REPLACE FUNCTION product_like_forbid_update()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'UPDATE on product_like is not allowed. Use DELETE+INSERT instead.';
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_like_update_forbid BEFORE UPDATE ON product_like
        FOR EACH ROW EXECUTE FUNCTION product_like_forbid_update();

      CREATE OR REPLACE FUNCTION set_viewed_date()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.viewed_date := NEW.viewed_at::date;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS trg_set_viewed_date ON product_view;
      CREATE TRIGGER trg_set_viewed_date
      BEFORE INSERT ON product_view
      FOR EACH ROW
      EXECUTE FUNCTION set_viewed_date();

      CREATE OR REPLACE FUNCTION inc_view_count()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE product SET view_count = view_count + 1 WHERE product_id = NEW.product_id;
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_view_insert AFTER INSERT ON product_view
        FOR EACH ROW EXECUTE FUNCTION inc_view_count();

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
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_orders_address_check
        BEFORE INSERT OR UPDATE OF shipping_address_id, customer_id ON orders
        FOR EACH ROW EXECUTE FUNCTION check_order_address_belongs_to_customer();

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

      CREATE OR REPLACE FUNCTION recalc_order_total()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE orders o
           SET total_amount = COALESCE((SELECT SUM(oi.line_total) FROM order_item oi WHERE oi.order_id = o.order_id), 0)
         WHERE o.order_id = COALESCE(NEW.order_id, OLD.order_id);
        RETURN COALESCE(NEW, OLD);
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_order_item_recalc_insert AFTER INSERT ON order_item
        FOR EACH ROW EXECUTE FUNCTION recalc_order_total();
      CREATE TRIGGER trg_order_item_recalc_update AFTER UPDATE ON order_item
        FOR EACH ROW EXECUTE FUNCTION recalc_order_total();
      CREATE TRIGGER trg_order_item_recalc_delete AFTER DELETE ON order_item
        FOR EACH ROW EXECUTE FUNCTION recalc_order_total();

      /* enum-like checks для product */
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

      /* backfill на случай наличия данных */
      UPDATE product SET material='Кожа'       WHERE material   IS NULL;
      UPDATE product SET popularity='new'      WHERE popularity IS NULL;
      UPDATE product SET collection='business' WHERE collection IS NULL;

      ALTER TABLE product
        ALTER COLUMN material   SET NOT NULL,
        ALTER COLUMN popularity SET NOT NULL,
        ALTER COLUMN collection SET NOT NULL;

      /* =========================
         4) view
      ========================== */
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
        p.material,
        p.popularity,
        p.collection,
        p.created_at,
        p.updated_at,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('url', pi.url, 'position', pi.position)
            ORDER BY pi.position
          ) FILTER (WHERE pi.url IS NOT NULL),
          '[]'::jsonb
        ) AS images,
        COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.kind = 'normal'), ARRAY[]::text[]) AS categories,
        ARRAY[p.material]   AS materials,
        ARRAY[p.collection] AS collections,
        ARRAY[p.popularity] AS popularity_arr
      FROM product p
      LEFT JOIN product_image   pi ON pi.product_id = p.product_id
      LEFT JOIN product_category pc ON pc.product_id = p.product_id
      LEFT JOIN category        c  ON c.category_id = pc.category_id
      GROUP BY p.product_id;

      /* =========================
         5) data patch: FillCategorySlugs (safe)
      ========================== */
      UPDATE category SET slug = CASE name
        WHEN 'Мужчинам'        THEN 'men'
        WHEN 'Женщинам'        THEN 'women'
        WHEN 'Патриотам'       THEN 'patriots'
        WHEN 'Гос.служащим'    THEN 'government'
        WHEN 'Для бизнеса'     THEN 'business'
        WHEN 'Премиум'         THEN 'premium'
        WHEN 'Культурный код'  THEN 'cultural'
        WHEN 'Имперский стиль' THEN 'imperial'
        WHEN 'Православие'     THEN 'orthodoxy'
        WHEN 'История'         THEN 'history'
        WHEN 'СССР'            THEN 'ussr'
        ELSE slug
      END
      WHERE kind = 'normal' AND (slug IS NULL OR slug = '');

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_category_slug'
        ) THEN
          CREATE INDEX idx_category_slug ON category (slug);
        END IF;
      END$$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      /* view */
      DROP VIEW IF EXISTS v_product_full;

      /* triggers first */
      DROP TRIGGER IF EXISTS trg_product_touch ON product;
      DROP TRIGGER IF EXISTS trg_company_reviews_touch ON company_reviews;
      DROP TRIGGER IF EXISTS trg_review_change ON review;
      DROP TRIGGER IF EXISTS trg_like_insert ON product_like;
      DROP TRIGGER IF EXISTS trg_like_delete ON product_like;
      DROP TRIGGER IF EXISTS trg_like_update_forbid ON product_like;
      DROP TRIGGER IF EXISTS trg_view_insert ON product_view;
      DROP TRIGGER IF EXISTS trg_set_viewed_date ON product_view;
      DROP TRIGGER IF EXISTS trg_orders_address_check ON orders;
      DROP TRIGGER IF EXISTS trg_order_item_recalc_insert ON order_item;
      DROP TRIGGER IF EXISTS trg_order_item_recalc_update ON order_item;
      DROP TRIGGER IF EXISTS trg_order_item_recalc_delete ON order_item;
      DROP TRIGGER IF EXISTS trg_orders_touch ON orders;

      /* functions */
      DROP FUNCTION IF EXISTS touch_updated_at;
      DROP FUNCTION IF EXISTS update_product_avg_rating;
      DROP FUNCTION IF EXISTS adjust_like_count;
      DROP FUNCTION IF EXISTS product_like_forbid_update;
      DROP FUNCTION IF EXISTS inc_view_count;
      DROP FUNCTION IF EXISTS set_viewed_date;
      DROP FUNCTION IF EXISTS check_order_address_belongs_to_customer;
      DROP FUNCTION IF EXISTS recalc_order_total;
      DROP FUNCTION IF EXISTS orders_touch_updated_at;

      /* explicit unique/indexes */
      DROP INDEX IF EXISTS uq_product_view_daily;
      DROP INDEX IF EXISTS uq_review_product_visitor;
      DROP INDEX IF EXISTS uq_review_product_customer;

      DROP INDEX IF EXISTS idx_category_slug;
      DROP INDEX IF EXISTS ux_category_slug_lower;
      DROP INDEX IF EXISTS idx_category_parent;
      DROP INDEX IF EXISTS idx_category_kind;
      DROP INDEX IF EXISTS idx_category_name_kind;

      DROP INDEX IF EXISTS idx_company_reviews_customer;
      DROP INDEX IF EXISTS idx_company_reviews_is_approved;
      DROP INDEX IF EXISTS idx_company_reviews_created_at;

      DROP INDEX IF EXISTS ux_address_default_per_customer;
      DROP INDEX IF EXISTS idx_product_image_product_id;
      DROP INDEX IF EXISTS ux_customer_email;

      DROP INDEX IF EXISTS idx_product_phone_model_id;
      DROP INDEX IF EXISTS idx_product_category_category_id;
      DROP INDEX IF EXISTS idx_orders_customer;
      DROP INDEX IF EXISTS idx_orders_shipping_address;
      DROP INDEX IF EXISTS idx_order_item_order;
      DROP INDEX IF EXISTS idx_order_item_product;
      DROP INDEX IF EXISTS idx_payment_order;
      DROP INDEX IF EXISTS idx_shipment_order;

      DROP INDEX IF EXISTS idx_review_product;
      DROP INDEX IF EXISTS idx_review_customer;
      DROP INDEX IF EXISTS idx_review_visitor;

      DROP INDEX IF EXISTS idx_product_like_product;
      DROP INDEX IF EXISTS idx_product_like_customer;
      DROP INDEX IF EXISTS idx_product_like_visitor;

      DROP INDEX IF EXISTS idx_product_favorite_product;
      DROP INDEX IF EXISTS idx_product_favorite_customer;
      DROP INDEX IF EXISTS idx_product_favorite_visitor;

      DROP INDEX IF EXISTS idx_product_view_product;
      DROP INDEX IF EXISTS idx_product_view_customer;
      DROP INDEX IF EXISTS idx_product_view_visitor;

      DROP INDEX IF EXISTS idx_comment_product;
      DROP INDEX IF EXISTS idx_comment_parent;

      DROP INDEX IF EXISTS idx_product_name_trgm;
      DROP INDEX IF EXISTS idx_product_price;
      DROP INDEX IF EXISTS idx_product_created_at;
      DROP INDEX IF EXISTS idx_product_avg_rating;
      DROP INDEX IF EXISTS idx_product_like_count;
      DROP INDEX IF EXISTS idx_product_view_count;

      DROP INDEX IF EXISTS idx_product_material;
      DROP INDEX IF EXISTS idx_product_popularity;
      DROP INDEX IF EXISTS idx_product_collection;

      DROP INDEX IF EXISTS idx_guest_session_last_seen;

      /* PHONE: откат индекса и CHECK для customer */
      DROP INDEX IF EXISTS ux_customer_phone_ru;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'customer_phone_format_ck'
            AND conrelid = 'customer'::regclass
        ) THEN
          ALTER TABLE customer DROP CONSTRAINT customer_phone_format_ck;
        END IF;
      END $$;

      /* tables (children first) */
      DROP TABLE IF EXISTS cart_item;
      DROP TABLE IF EXISTS cart;
      DROP TABLE IF EXISTS guest_session;

      DROP TABLE IF EXISTS comment;
      DROP TABLE IF EXISTS product_view;
      DROP TABLE IF EXISTS product_favorite;
      DROP TABLE IF EXISTS product_like;
      DROP TABLE IF EXISTS review;
      DROP TABLE IF EXISTS shipment;
      DROP TABLE IF EXISTS payment;
      DROP TABLE IF EXISTS order_item;

      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_ck;
      DROP TABLE IF EXISTS orders;

      DROP TABLE IF EXISTS address;
      DROP TABLE IF EXISTS product_category;
      DROP TABLE IF EXISTS product_image;

      ALTER TABLE IF EXISTS product DROP CONSTRAINT IF EXISTS product_material_ck;
      ALTER TABLE IF EXISTS product DROP CONSTRAINT IF EXISTS product_popularity_ck;
      ALTER TABLE IF EXISTS product DROP CONSTRAINT IF EXISTS product_collection_ck;
      DROP TABLE IF EXISTS product;

      ALTER TABLE IF EXISTS category DROP CONSTRAINT IF EXISTS uq_category_slug;
      DROP TABLE IF EXISTS category;

      DROP TABLE IF EXISTS phone_model;
      DROP TABLE IF EXISTS company_reviews;

      DROP TABLE IF EXISTS customer;

      DROP EXTENSION IF EXISTS pg_trgm;
    `);
  }
}
