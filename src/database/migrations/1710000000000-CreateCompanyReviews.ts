// src/database/migrations/1710000000000-CreateCompanyReviews.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyReviews1710000000000 implements MigrationInterface {
  name = 'CreateCompanyReviews1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // основная таблица
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS company_reviews (
        id           BIGSERIAL PRIMARY KEY,
        customer_id  INTEGER NOT NULL,
        rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        text         TEXT NOT NULL,
        is_approved  BOOLEAN NOT NULL DEFAULT false,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_company_reviews_customer
          FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE CASCADE
      );
    `);

    // индексы
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_company_reviews_customer   ON company_reviews(customer_id);
      CREATE INDEX IF NOT EXISTS idx_company_reviews_is_approved ON company_reviews(is_approved);
      CREATE INDEX IF NOT EXISTS idx_company_reviews_created_at  ON company_reviews(created_at);
    `);

    // функция и триггер для updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_company_reviews_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_company_reviews_set_updated_at
      BEFORE UPDATE ON company_reviews
      FOR EACH ROW
      EXECUTE PROCEDURE set_company_reviews_updated_at();
    `);

    // представление среднего рейтинга по одобренным отзывам
    await queryRunner.query(`
      CREATE OR REPLACE VIEW company_rating_view AS
      SELECT
        COALESCE(AVG(rating)::numeric(3,2), 0.00) AS avg_company_rating,
        COUNT(*)::int                             AS reviews_count
      FROM company_reviews
      WHERE is_approved = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS company_rating_view;`);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_company_reviews_set_updated_at ON company_reviews;
      DROP FUNCTION IF EXISTS set_company_reviews_updated_at;
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS company_reviews;`);
  }
}
