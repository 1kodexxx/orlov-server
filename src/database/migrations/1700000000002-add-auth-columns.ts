// src/database/migrations/1700000000002-add-auth-columns.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthColumns1700000000002 implements MigrationInterface {
  name = 'AddAuthColumns1700000000002';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE customer ADD COLUMN IF NOT EXISTS password_hash TEXT`,
    );
    await qr.query(
      `UPDATE customer SET password_hash = '' WHERE password_hash IS NULL`,
    );
    await qr.query(
      `ALTER TABLE customer ALTER COLUMN password_hash SET NOT NULL`,
    );

    await qr.query(
      `ALTER TABLE customer ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'customer'`,
    );
    await qr.query(`UPDATE customer SET role = 'customer' WHERE role IS NULL`);
    await qr.query(`ALTER TABLE customer ALTER COLUMN role SET NOT NULL`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE customer DROP COLUMN IF EXISTS role`);
    await qr.query(`ALTER TABLE customer DROP COLUMN IF EXISTS password_hash`);
  }
}
