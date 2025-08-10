import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductView } from '../shop/entities/product-view.entity';
import { Product } from '../shop/entities/product.entity';
import { User } from '../users/users.entity';

@Injectable()
export class ViewsService {
  constructor(
    @InjectRepository(ProductView)
    private readonly views: Repository<ProductView>,
  ) {}

  async addView(
    productId: number,
    customerId: number | null,
    ip: string | null,
    ua: string | null,
  ): Promise<void> {
    const view = this.views.create({
      product: { id: productId } as Product,
      customer: customerId ? ({ id: customerId } as User) : null,
      ip,
      userAgent: ua,
    });

    await this.views.save(view);
    // триггер/матвью пересчитает view_count в продукте — возвращать ничего не нужно
  }
}
