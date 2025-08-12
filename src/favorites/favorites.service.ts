import { Injectable } from '@nestjs/common';
import {
  LikesService,
  Owner as LikesOwner,
} from '../catalog/likes/likes.service';
import type { ProductRow } from '../catalog/catalog.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly likes: LikesService) {}

  async getFavorites(owner: LikesOwner): Promise<ProductRow[]> {
    return this.likes.getFavorites(owner);
  }

  async getFavoriteIds(owner: LikesOwner): Promise<number[]> {
    const rows = await this.getFavorites(owner);
    return rows.map((r) => r.product_id);
  }
}
