import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenVersion1700000000004 implements MigrationInterface {
  name = 'AddTokenVersion1700000000004';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE "customer"
      ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE "customer" DROP COLUMN IF EXISTS "token_version"
    `);
  }
}
