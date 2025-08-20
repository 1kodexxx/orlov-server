import { DataSource } from 'typeorm';
import { testimonials } from '../../data/reviews.data';

/** Разбиваем "Имя Фамилия" на first/last */
function splitName(full: string): { first: string; last: string } {
  const parts = (full ?? '').trim().split(/\s+/);
  if (parts.length === 0) return { first: 'Гость', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/** Гарантируем наличие пользователя c email reviewer{n}@orlov.local */
async function ensureUser(
  ds: DataSource,
  author: string,
  roleText: string,
  avatarUrl: string,
  seq: number, // порядковый номер, чтобы email был уникальным
): Promise<number> {
  const email = `reviewer${seq}@orlov.local`;
  const found = await ds.query(
    `SELECT customer_id FROM customer WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  if (found.length) return Number(found[0].customer_id);

  const { first, last } = splitName(author);
  const rows = await ds.query(
    `INSERT INTO customer
      (first_name, last_name, email, role, avatar_url, headline)
     VALUES ($1, $2, $3, 'customer', $4, $5)
     RETURNING customer_id`,
    [first, last, email, avatarUrl || null, roleText || null],
  );
  return Number(rows[0].customer_id);
}

/**
 * Сидим company_reviews из data1/reviews.data.ts:
 * - для каждого testimonial создаём отдельного пользователя (или находим),
 * - пишем отзыв от его имени,
 * - избегаем дублей по text.
 */
export default async function seedCompanyReviews(
  ds: DataSource,
): Promise<void> {
  let inserted = 0;
  let skipped = 0;

  // по одному отзыву на каждого автора из массива
  for (let i = 0; i < testimonials.length; i++) {
    const t = testimonials[i];
    const text = t?.text?.trim();
    if (!text) continue;

    // пропускаем дубликаты по text
    const exists = await ds.query(
      `SELECT 1 FROM company_reviews WHERE text = $1 LIMIT 1`,
      [text],
    );
    if (exists.length) {
      skipped++;
      continue;
    }

    const customerId = await ensureUser(ds, t.author, t.role, t.avatar, i + 1);

    // случайная дата за 180 дней
    const created = new Date(
      Date.now() - Math.floor(Math.random() * 180) * 86400000,
    ).toISOString();

    await ds.query(
      `INSERT INTO company_reviews
        (customer_id, rating, text, is_approved, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [customerId, 5, text, true, created, created],
    );

    inserted++;
  }

  console.log(`✓ Company reviews: inserted=${inserted}, skipped=${skipped}`);
}

/** ---- Самозапуск при прямом вызове файла (npm run seed:reviews) ---- */
if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    const { default: ds } = await import('../data-source');
    if (!ds) throw new Error('Default DataSource not found in ../data-source');

    await ds.initialize();
    await seedCompanyReviews(ds);
    await ds.destroy();
  })().catch((e) => {
    console.error('Seed company reviews failed:', e);
    process.exit(1);
  });
}
