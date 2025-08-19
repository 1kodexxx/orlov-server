import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerPhoneConstraints1723705000000
  implements MigrationInterface
{
  name = 'AddCustomerPhoneConstraints1723705000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      /* 1) Нормализация существующих телефонов -> +7XXXXXXXXXX */
      WITH src AS (
        SELECT
          customer_id,
          phone,
          -- берём только цифры
          regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') AS d
        FROM customer
      ),
      normed AS (
        SELECT
          customer_id,
          CASE
            WHEN d IS NULL OR d = ''            THEN NULL
            WHEN phone ~ '^\\+7\\d{10}$'        THEN phone                                 -- уже норм
            WHEN d ~ '^8\\d{10}$'               THEN '+7' || substr(d, 2, 10)              -- 8XXXXXXXXXX -> +7XXXXXXXXXX
            WHEN d ~ '^7\\d{10}$'               THEN '+7' || substr(d, 2, 10)              -- 7XXXXXXXXXX  -> +7XXXXXXXXXX
            WHEN d ~ '^\\d{10}$'                THEN '+7' || d                              -- 10-значный   -> +7XXXXXXXXXX
            ELSE NULL
          END AS norm
        FROM src
      )
      UPDATE customer c
         SET phone = n.norm
      FROM normed n
      WHERE n.customer_id = c.customer_id
        AND (n.norm IS DISTINCT FROM c.phone);

      /* 2) Удалим дубликаты: у «лишних» строк phone -> NULL (оставим самую раннюю регистрацию) */
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

      /* 3) CHECK: либо NULL, либо +7XXXXXXXXXX */
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

      /* 4) UNIQUE индекс только для NOT NULL */
      CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_phone_ru
        ON customer (phone) WHERE phone IS NOT NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      /* Откатываем уникальный индекс и CHECK */
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
    `);
  }
}
