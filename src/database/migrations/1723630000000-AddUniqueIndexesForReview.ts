import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueIndexesForReview1723630000000
  implements MigrationInterface
{
  name = 'AddUniqueIndexesForReview1723630000000 ';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // review: один рейтинг на пользователя для товара
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_review_product_customer
      ON review (product_id, customer_id);
    `);

    // review: один рейтинг на гостя (visitor_id) для товара
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_review_product_visitor
      ON review (product_id, visitor_id);
    `);

    // product_view: один просмотр в сутки на пару (product, owner)
    // owner = customer_id (или -1) + visitor_id (или UUID-нулевой)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_product_view_daily
      ON product_view (
        product_id,
        COALESCE(customer_id, -1),
        COALESCE(visitor_id, '00000000-0000-0000-0000-000000000000'::uuid),
        viewed_date
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_product_view_daily;`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_review_product_visitor;`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_review_product_customer;`);
  }
}
