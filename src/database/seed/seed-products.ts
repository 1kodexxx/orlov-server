import { DataSource } from 'typeorm';
import { allProducts } from '../../data/products.data';

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

const seedProductsData: SeedProduct[] = allProducts.map((p) => ({
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
async function slugExists(ds: DataSource, slug: string): Promise<boolean> {
  const rows = await ds.query<{ exists: boolean }[]>(
    `SELECT EXISTS(
       SELECT 1 FROM category WHERE lower(slug) = lower($1)
     ) AS exists`,
    [slug],
  );
  return !!rows[0]?.exists;
}

/** Подобрать уникальный slug с суффиксом -2, -3, ... если нужно */
async function ensureUniqueSlug(ds: DataSource, base: string): Promise<string> {
  const attempt = base || 'item';
  if (!(await slugExists(ds, attempt))) return attempt;

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await slugExists(ds, candidate))) return candidate;
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
async function upsertCategoryByName(
  ds: DataSource,
  name: string,
  kind: Kind,
): Promise<number> {
  const baseSlug = slugify(name);
  const uniqueSlug = await ensureUniqueSlug(ds, baseSlug);

  const row = await ds.query(
    `INSERT INTO category(name, slug, kind)
       VALUES ($1, $2, $3)
       ON CONFLICT (name)
       DO UPDATE SET kind = EXCLUDED.kind
       RETURNING category_id`,
    [name, uniqueSlug, kind],
  );
  return row[0].category_id as number;
}

const upsertCategoryNormal = (ds: DataSource, n: string) =>
  upsertCategoryByName(ds, n, 'normal');
const upsertCategoryMaterial = (ds: DataSource, n: string) =>
  upsertCategoryByName(ds, n, 'material');
const upsertCategoryPopularity = (ds: DataSource, n: string) =>
  upsertCategoryByName(ds, n, 'popularity');
const upsertCategoryCollection = (ds: DataSource, n: string) =>
  upsertCategoryByName(ds, n, 'collection');

/* ---------------- phone model ---------------- */

async function upsertPhoneModel(
  ds: DataSource,
  brand = 'Universal',
  model = 'Any',
) {
  const row = await ds.query(
    `INSERT INTO phone_model(brand, model_name)
     VALUES ($1,$2)
     ON CONFLICT (brand, model_name) DO UPDATE SET brand=EXCLUDED.brand
     RETURNING model_id`,
    [brand, model],
  );
  return row[0].model_id as number;
}

/* ---------------- product & links ---------------- */

async function upsertProduct(
  ds: DataSource,
  p: SeedProduct,
  phoneModelId: number,
) {
  const row = await ds.query(
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

const ensureImage = (
  ds: DataSource,
  productId: number,
  url: string,
  ord: number,
) =>
  ds.query(
    `INSERT INTO product_image (product_id, url, "position")
     VALUES ($1, $2, $3)
     ON CONFLICT (product_id, url) DO NOTHING`,
    [productId, url, ord],
  );

const linkCategory = (ds: DataSource, productId: number, categoryId: number) =>
  ds.query(
    `INSERT INTO product_category(product_id, category_id)
     VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [productId, categoryId],
  );

/* ---------------- seed meta dictionaries ---------------- */

async function ensureMetaDictionaries(ds: DataSource) {
  // materials
  await upsertCategoryMaterial(ds, 'Кожа');
  await upsertCategoryMaterial(ds, 'Металл');
  await upsertCategoryMaterial(ds, 'Силикон');

  // popularity
  await upsertCategoryPopularity(ds, 'hit');
  await upsertCategoryPopularity(ds, 'new');
  await upsertCategoryPopularity(ds, 'recommended');

  // collections
  await upsertCategoryCollection(ds, 'business');
  await upsertCategoryCollection(ds, 'limited');
  await upsertCategoryCollection(ds, 'premium');
  await upsertCategoryCollection(ds, 'autumn2025');
}

/* ---------------- public API ---------------- */

export async function seedProducts(ds: DataSource) {
  console.log('> Seeding products…');

  await ensureMetaDictionaries(ds);

  const phoneModelId = await upsertPhoneModel(ds);

  for (const p of seedProductsData) {
    const productId = await upsertProduct(ds, p, phoneModelId);

    // images
    for (let i = 0; i < p.images.length; i++) {
      await ensureImage(ds, productId, p.images[i], i + 1);
    }

    // normal categories
    for (const c of p.categories) {
      const catId = await upsertCategoryNormal(ds, c);
      await linkCategory(ds, productId, catId);
    }
  }

  console.log(`✓ Seeded ${seedProductsData.length} products`);
}
