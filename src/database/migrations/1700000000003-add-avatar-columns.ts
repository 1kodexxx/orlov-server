// src/database/migrations/1700000000003-add-avatar-columns.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarColumns1700000000003 implements MigrationInterface {
  name = 'AddAvatarColumns1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) колонки для аватара
    await queryRunner.query(`
      ALTER TABLE "customer"
      ADD COLUMN IF NOT EXISTS "avatar_url"        varchar(500),
      ADD COLUMN IF NOT EXISTS "avatar_updated_at" timestamptz
    `);

    // 2) password_hash -> TEXT (под длинный argon2)
    await queryRunner.query(`
      ALTER TABLE "customer"
      ALTER COLUMN "password_hash" TYPE text
    `);

    // 3) registered_at -> timestamptz (только если сейчас "timestamp")
    await queryRunner.query(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customer'
      AND column_name = 'registered_at'
      AND udt_name = 'timestamp'
  ) THEN
    ALTER TABLE "customer"
    ALTER COLUMN "registered_at" TYPE timestamptz
    USING "registered_at" AT TIME ZONE 'UTC';
  END IF;
END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer"
      DROP COLUMN IF EXISTS "avatar_updated_at",
      DROP COLUMN IF EXISTS "avatar_url"
    `);
    // Типы назад не откатываем — не критично.
  }
}
