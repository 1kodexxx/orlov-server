// src/database/seed/seed-products.ts
import { allProducts } from '../../data/products.data';

export type SeedProduct = {
  id: number;
  slug: string; // -> product.sku
  name: string;
  images: string[]; // -> product_image
  price: number;
  categories: string[]; // русские названия категорий
  description: string;

  // дополнительные поля, которые использует миграция
  views?: number; // -> product.view_count
  likes?: number; // -> product.like_count
  avgRating?: number; // -> product.avg_rating
};

export const seedProducts: SeedProduct[] = allProducts.map((p) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  images: p.images,
  price: p.price,
  categories: p.categories,
  description: p.description,

  // дефолты (если в файле нет значений)
  views: p.views ?? 0,
  likes: p.likes ?? 0,
  avgRating: p.avgRating ?? 0,
}));
