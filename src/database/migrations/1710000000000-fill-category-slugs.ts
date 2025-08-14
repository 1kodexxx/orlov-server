import { MigrationInterface, QueryRunner } from 'typeorm';

export class FillCategorySlugs1710000000000 implements MigrationInterface {
  name = 'FillCategorySlugs1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE category SET slug = CASE name
        WHEN 'Мужчинам'       THEN 'men'
        WHEN 'Женщинам'       THEN 'women'
        WHEN 'Патриотам'      THEN 'patriots'
        WHEN 'Гос.служащим'   THEN 'government'
        WHEN 'Для бизнеса'    THEN 'business'
        WHEN 'Премиум'        THEN 'premium'
        WHEN 'Культурный код' THEN 'cultural'
        WHEN 'Имперский стиль'THEN 'imperial'
        WHEN 'Православие'    THEN 'orthodoxy'
        WHEN 'История'        THEN 'history'
        WHEN 'СССР'           THEN 'ussr'
        ELSE slug
      END
      WHERE kind = 'normal' AND (slug IS NULL OR slug = '');
    `);

    // Индекс по slug на всякий случай
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_category_slug'
        ) THEN
          CREATE INDEX idx_category_slug ON category (slug);
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Откатывать в NULL не обязательно, но сделаем мягкий откат
    await queryRunner.query(`
      UPDATE category
         SET slug = NULL
       WHERE slug IN ('men','women','patriots','government','business','premium','cultural','imperial','orthodoxy','history','ussr');
    `);
  }
}
