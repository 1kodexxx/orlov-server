// src/database/seed/seed-product-comments.ts
import { allProducts } from '../../data/products.data';

export type SeedProductComment = {
  productId: number;
  userId: number;
  userName: string;
  text: string;
  createdAt: string;
};

export const seedProductComments: SeedProductComment[] = allProducts.flatMap(
  (p) =>
    p.comments.map((c) => ({
      productId: p.id,
      userId: c.userId,
      userName: c.userName,
      text: c.text,
      createdAt: c.createdAt,
    })),
);
