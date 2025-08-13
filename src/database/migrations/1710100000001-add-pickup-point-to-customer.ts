import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPickupPointToCustomer1710100000001
  implements MigrationInterface
{
  name = 'AddPickupPointToCustomer1710100000001';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE customer
      ADD COLUMN IF NOT EXISTS pickup_point varchar(200)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE customer
      DROP COLUMN IF EXISTS pickup_point
    `);
  }
}
