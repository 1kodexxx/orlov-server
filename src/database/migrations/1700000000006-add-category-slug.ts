import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategorySlug1700000000006 implements MigrationInterface {
  name = 'AddCategorySlug1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "category"
            ADD COLUMN "slug" varchar(255) NOT NULL DEFAULT ''
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "category"
            DROP COLUMN "slug"
        `);
  }
}
