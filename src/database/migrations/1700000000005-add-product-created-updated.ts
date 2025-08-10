import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCreatedUpdated1700000000005
  implements MigrationInterface
{
  name = 'AddProductCreatedUpdated1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем колонки, если отсутствуют
    await queryRunner.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE product
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE product
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;
    `);

    // Функция и триггер для авто-обновления updated_at
    await queryRunner.query(`
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_product_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_product_set_updated_at
      BEFORE UPDATE ON product
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем триггер и функцию (безопасно, если вдруг нет)
    await queryRunner.query(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_set_updated_at'
  ) THEN
    DROP TRIGGER trg_product_set_updated_at ON product;
  END IF;
END $$;

DROP FUNCTION IF EXISTS set_updated_at_timestamp();
    `);

    // Колонки можно дропнуть, если они были созданы этой миграцией
    await queryRunner.query(`
ALTER TABLE product
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS created_at;
    `);
  }
}
