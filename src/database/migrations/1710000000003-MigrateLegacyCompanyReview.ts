import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateLegacyCompanyReview1710000000003
  implements MigrationInterface
{
  name = 'MigrateLegacyCompanyReview1710000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Если старая таблица есть — переливаем данные
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'company_review'
        ) THEN
          INSERT INTO company_reviews (customer_id, rating, text, is_approved, created_at, updated_at)
          SELECT
            customer_id,
            rating,
            comment      AS text,
            true         AS is_approved,        -- считаем старые отзывы одобренными
            review_date  AS created_at,
            review_date  AS updated_at
          FROM public.company_review
          ON CONFLICT DO NOTHING;
          
          -- Удаляем триггер и функцию, если были
          IF EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'trg_company_review_stats'
          ) THEN
            DROP TRIGGER IF EXISTS trg_company_review_stats ON public.company_review;
          END IF;

          -- Если у тебя есть функция refresh_company_stats, и она больше не нужна:
          -- DROP FUNCTION IF EXISTS public.refresh_company_stats();

          DROP TABLE public.company_review;
        END IF;
      END
      $$;
    `);
  }

  public async down(): Promise<void> {
    // Ничего не делаем (обратная миграция не нужна)
  }
}
