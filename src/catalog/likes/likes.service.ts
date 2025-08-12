import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ProductRow } from '../catalog.service';

export type Owner = { customerId?: number; visitorId?: string | null };

@Injectable()
export class LikesService {
  constructor(private readonly ds: DataSource) {}

  private async recalcLikeCount(productId: number): Promise<void> {
    await this.ds.query(
      `UPDATE product
          SET like_count = (SELECT COUNT(*)::int FROM product_like pl WHERE pl.product_id = $1)
        WHERE product_id = $1`,
      [productId],
    );
  }

  async likeOnce(productId: number, owner: Owner): Promise<{ liked: true }> {
    const { customerId, visitorId } = owner;
    if (!customerId && !visitorId) {
      throw new Error('owner required');
    }
    await this.ds.query(
      `INSERT INTO product_like(product_id, customer_id, visitor_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [productId, customerId ?? null, visitorId ?? null],
    );
    await this.recalcLikeCount(productId);
    return { liked: true };
  }

  async unlike(productId: number, owner: Owner): Promise<{ liked: false }> {
    const { customerId, visitorId } = owner;
    await this.ds.query(
      `DELETE FROM product_like
        WHERE product_id = $1
          AND (customer_id = $2 OR visitor_id = $3)`,
      [productId, customerId ?? null, visitorId ?? null],
    );
    await this.recalcLikeCount(productId);
    return { liked: false };
  }

  async getFavorites(owner: Owner): Promise<ProductRow[]> {
    const { customerId, visitorId } = owner;
    const rows = await this.ds.query<ProductRow[]>(
      `SELECT vp.*
         FROM product_like pl
         JOIN v_product_full vp ON vp.product_id = pl.product_id
        WHERE ($1::int  IS NOT NULL AND pl.customer_id = $1)
           OR ($2::uuid IS NOT NULL AND pl.visitor_id = $2)
        ORDER BY vp.created_at DESC`,
      [customerId ?? null, visitorId ?? null],
    );
    return rows;
  }
}
