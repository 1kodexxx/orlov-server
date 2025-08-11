import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHeadlineOrganizationToCustomer1710000000002
  implements MigrationInterface
{
  name = 'AddHeadlineOrganizationToCustomer1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customer
        ADD COLUMN IF NOT EXISTS headline     varchar(200),
        ADD COLUMN IF NOT EXISTS organization varchar(200)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customer
        DROP COLUMN IF EXISTS organization,
        DROP COLUMN IF EXISTS headline
    `);
  }
}
