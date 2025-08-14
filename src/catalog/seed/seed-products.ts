// src/database/seed/seed-products.ts
import { allProducts } from '../../data1/products.data';

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

  materials: ('Кожа' | 'Металл' | 'Силикон')[];
  popularity: ('hit' | 'new' | 'recommended')[];
  collections: ('business' | 'limited' | 'premium' | 'autumn2025')[];
};

// функция для выбора случайных элементов из массива
function getRandomSubset<T>(arr: readonly T[], min: number = 1): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  const count = Math.floor(Math.random() * (arr.length - min + 1)) + min;
  return shuffled.slice(0, count);
}

const MATERIALS = ['Кожа', 'Металл', 'Силикон'] as const;
const POPULARITY = ['hit', 'new', 'recommended'] as const;
const COLLECTIONS = ['business', 'limited', 'premium', 'autumn2025'] as const;

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

  // случайные наборы свойств
  materials: getRandomSubset(MATERIALS, 1),
  popularity: getRandomSubset(POPULARITY, 1),
  collections: getRandomSubset(COLLECTIONS, 1),
}));
