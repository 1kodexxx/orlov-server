// src/database/seed/seed-products.ts
import 'dotenv/config';
import dataSource from '../data-source';
import { allProducts } from '../../data/products.data';

type SeedProduct = {
  id: number;
  slug: string; // -> product.sku
  name: string;
  images: string[]; // -> product_image
  price: number;
  categories: string[]; // русские названия категорий
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
  description: p.description,
  views: p.views ?? 0,
  likes: p.likes ?? 0,
  avgRating: p.avgRating ?? 0,
}));

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

async function upsertCategory(name: string) {
  const slug = slugify(name);
  const row = await dataSource.query(
    `INSERT INTO category(name, slug)
         VALUES ($1, $2)
         ON CONFLICT ON CONSTRAINT category_name_key
         DO UPDATE SET slug = EXCLUDED.slug
         RETURNING category_id`,
    [name, slug],
  );
  return row[0].category_id as number;
}

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

async function upsertProduct(p: SeedProduct, phoneModelId: number) {
  const row = await dataSource.query(
    `INSERT INTO product (product_id, sku, name, description, price, stock_quantity,
                          phone_model_id, view_count, like_count, avg_rating)
     VALUES ($1,$2,$3,$4,$5, 100, $6, $7, $8, $9)
     ON CONFLICT (sku) DO UPDATE
       SET name=EXCLUDED.name,
           description=EXCLUDED.description,
           price=EXCLUDED.price,
           phone_model_id=EXCLUDED.phone_model_id,
           view_count=EXCLUDED.view_count,
           like_count=EXCLUDED.like_count,
           avg_rating=EXCLUDED.avg_rating
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

async function main() {
  await dataSource.initialize();
  console.log('> DB connected');

  const phoneModelId = await upsertPhoneModel();

  for (const p of seedProducts) {
    const productId = await upsertProduct(p, phoneModelId);

    // images
    for (let i = 0; i < p.images.length; i++) {
      await ensureImage(productId, p.images[i], i + 1);
    }

    // categories
    for (const c of p.categories) {
      const catId = await upsertCategory(c);
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
