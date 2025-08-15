// src/database/seed/seed-company-reviews.ts
import { DataSource } from 'typeorm';
import { testimonials } from '../../data1/reviews.data';

/**
 * Сидит таблицу company_reviews текстами из data1/reviews.data.ts.
 * Все отзывы привязываем к существующему пользователю (по умолчанию customer_id = 1),
 * рейтинг = 5, is_approved = true.
 * Дубликаты по text не вставляем.
 */
export default async function seedCompanyReviews(
  ds: DataSource,
  ownerId: number = Number(process.env.SEED_OWNER_ID ?? 1),
) {
  let inserted = 0;
  let skipped = 0;

  for (const t of testimonials) {
    // проверим, что такого текста ещё нет
    const exists = await ds.query(
      `SELECT id FROM company_reviews WHERE text = $1 LIMIT 1`,
      [t.text],
    );

    if (exists.length) {
      skipped++;
      continue;
    }

    // раскидаем даты в пределах последних 180 дней
    const now = Date.now();
    const days = Math.floor(Math.random() * 180);
    const created = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

    await ds.query(
      `INSERT INTO company_reviews
        (customer_id, rating, text, is_approved, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ownerId, 5, t.text, true, created, created],
    );

    inserted++;
  }

  console.log(`✓ Company reviews: inserted=${inserted}, skipped=${skipped}`);
}
