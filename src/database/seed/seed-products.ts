// src/database/seed/seed-products.ts
import 'dotenv/config';
import dataSource from '../data-source';
import { allProducts } from '../../data1/products.data';

type SeedProduct = {
  id: number;
  slug: string; // -> product.sku
  name: string;
  images: string[]; // -> product_image
  price: number;
  categories: string[]; // русские названия категорий (kind='normal')
  material: 'Кожа' | 'Металл' | 'Силикон';
  popularity: 'hit' | 'new' | 'recommended';
  collection: 'business' | 'limited' | 'premium' | 'autumn2025';
  description: string;
  views?: number; // -> product.view_count
  likes?: number; // -> product.like_count
  avgRating?: number; // -> product.avg_rating
};

const seedProducts: SeedProduct[] = allProducts.map((p) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  images: p.images,
  price: p.price,
  categories: p.categories,
  material: p.material,
  popularity: p.popularity,
  collection: p.collection,
  description: p.description,
  views: p.views ?? 0,
  likes: p.likes ?? 0,
  avgRating: p.avgRating ?? 0,
}));

/* ---------------- utils ---------------- */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

/** Проверить занятость slugs (учитывая unique index по lower(slug)) */
async function slugExists(slug: string): Promise<boolean> {
  const rows = await dataSource.query<{ exists: boolean }[]>(
    `SELECT EXISTS(
       SELECT 1 FROM category WHERE lower(slug) = lower($1)
     ) AS exists`,
    [slug],
  );
  return !!rows[0]?.exists;
}

/** Подобрать уникальный slug с суффиксом -2, -3, ... если нужно */
async function ensureUniqueSlug(base: string): Promise<string> {
  const attempt = base || 'item';
  if (!(await slugExists(attempt))) return attempt;

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await slugExists(candidate))) return candidate;
  }

  // на всякий случай добавим timestamp-хвост
  return `${base}-${Date.now()}`;
}

/* ---------------- category upserts ---------------- */

type Kind = 'normal' | 'material' | 'collection' | 'popularity';

/**
 * Апсерт категории по ИМЕНИ (UNIQUE(name)).
 * При вставке подбираем уникальный slug.
 * При конфликте по name — только обновляем kind, slug НЕ трогаем (чтобы не словить конфликт по slug).
 */
async function upsertCategoryByName(name: string, kind: Kind): Promise<number> {
  const baseSlug = slugify(name);
  const uniqueSlug = await ensureUniqueSlug(baseSlug);

  const row = await dataSource.query(
    `INSERT INTO category(name, slug, kind)
       VALUES ($1, $2, $3)
       ON CONFLICT (name)
       DO UPDATE SET kind = EXCLUDED.kind
       RETURNING category_id`,
    [name, uniqueSlug, kind],
  );
  return row[0].category_id as number;
}

async function upsertCategoryNormal(name: string) {
  return upsertCategoryByName(name, 'normal');
}
async function upsertCategoryMaterial(name: string) {
  return upsertCategoryByName(name, 'material');
}
async function upsertCategoryPopularity(name: string) {
  return upsertCategoryByName(name, 'popularity');
}
async function upsertCategoryCollection(name: string) {
  return upsertCategoryByName(name, 'collection');
}

/* ---------------- phone model ---------------- */

async function upsertPhoneModel(brand = 'Universal', model = 'Any') {
  const row = await dataSource.query(
    `INSERT INTO phone_model(brand, model_name)
     VALUES ($1,$2)
     ON CONFLICT (brand, model_name) DO UPDATE SET brand=EXCLUDED.brand
     RETURNING model_id`,
    [brand, model],
  );
  return row[0].model_id as number;
}

/* ---------------- product & links ---------------- */

async function upsertProduct(p: SeedProduct, phoneModelId: number) {
  const row = await dataSource.query(
    `INSERT INTO product (
        product_id, sku, name, description, price, stock_quantity,
        phone_model_id, view_count, like_count, avg_rating,
        material, popularity, collection
      )
     VALUES ($1,$2,$3,$4,$5, 100, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (sku) DO UPDATE
       SET name=EXCLUDED.name,
           description=EXCLUDED.description,
           price=EXCLUDED.price,
           phone_model_id=EXCLUDED.phone_model_id,
           view_count=EXCLUDED.view_count,
           like_count=EXCLUDED.like_count,
           avg_rating=EXCLUDED.avg_rating,
           material=EXCLUDED.material,
           popularity=EXCLUDED.popularity,
           collection=EXCLUDED.collection
     RETURNING product_id`,
    [
      p.id,
      p.slug,
      p.name,
      p.description,
      p.price,
      phoneModelId,
      Math.max(0, p.views ?? 0),
      Math.max(0, p.likes ?? 0),
      Number((p.avgRating ?? 0).toFixed(2)),
      p.material,
      p.popularity,
      p.collection,
    ],
  );
  return row[0].product_id as number;
}

async function ensureImage(productId: number, url: string, ord: number) {
  await dataSource.query(
    `INSERT INTO product_image (product_id, url, "position")
     VALUES ($1, $2, $3)
     ON CONFLICT (product_id, url) DO NOTHING`,
    [productId, url, ord],
  );
}

async function linkCategory(productId: number, categoryId: number) {
  await dataSource.query(
    `INSERT INTO product_category(product_id, category_id)
     VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [productId, categoryId],
  );
}

/* ---------------- seed meta dictionaries ---------------- */

async function ensureMetaDictionaries() {
  // materials
  await upsertCategoryMaterial('Кожа');
  await upsertCategoryMaterial('Металл');
  await upsertCategoryMaterial('Силикон');

  // popularity
  await upsertCategoryPopularity('hit');
  await upsertCategoryPopularity('new');
  await upsertCategoryPopularity('recommended');

  // collections
  await upsertCategoryCollection('business');
  await upsertCategoryCollection('limited');
  await upsertCategoryCollection('premium');
  await upsertCategoryCollection('autumn2025');
}

/* ---------------- main ---------------- */

async function main() {
  await dataSource.initialize();
  console.log('> DB connected');

  // справочники для фильтров
  await ensureMetaDictionaries();

  const phoneModelId = await upsertPhoneModel();

  for (const p of seedProducts) {
    const productId = await upsertProduct(p, phoneModelId);

    // images
    for (let i = 0; i < p.images.length; i++) {
      await ensureImage(productId, p.images[i], i + 1);
    }

    // normal categories
    for (const c of p.categories) {
      const catId = await upsertCategoryNormal(c);
      await linkCategory(productId, catId);
    }
  }

  console.log(`✓ Seeded ${seedProducts.length} products`);
  await dataSource.destroy();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await dataSource.destroy();
  } catch {
    // ignore
  }
  process.exit(1);
});
