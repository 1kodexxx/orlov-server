import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviewGuestSupport1710000099999 implements MigrationInterface {
  name = 'ReviewGuestSupport1710000099999';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE review
        ADD COLUMN IF NOT EXISTS visitor_id uuid;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'review_exactly_one_owner'
            AND conrelid = 'review'::regclass
        ) THEN
          ALTER TABLE review
          ADD CONSTRAINT review_exactly_one_owner
          CHECK (
            (customer_id IS NOT NULL AND visitor_id IS NULL) OR
            (customer_id IS NULL AND visitor_id IS NOT NULL)
          );
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS ux_review_customer
        ON review(product_id, customer_id) WHERE customer_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS ux_review_visitor
        ON review(product_id, visitor_id) WHERE visitor_id IS NOT NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX IF EXISTS ux_review_customer;
      DROP INDEX IF EXISTS ux_review_visitor;
      ALTER TABLE review DROP CONSTRAINT IF EXISTS review_exactly_one_owner;
      ALTER TABLE review DROP COLUMN IF EXISTS visitor_id;
    `);
  }
}
