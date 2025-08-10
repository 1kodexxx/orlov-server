// src/shop/shop.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { PhoneModel } from './entities/phone-model.entity';
import { QueryShopDto } from './dto/query-shop.dto';

type ItemsWithMeta<T> = {
  items: T[];
  meta: { page: number; limit: number; total: number };
};

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(PhoneModel)
    private readonly models: Repository<PhoneModel>,
  ) {}

  private baseQB(): SelectQueryBuilder<Product> {
    return this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categories', 'c')
      .leftJoinAndSelect('p.phoneModel', 'm');
  }

  async findAll(dto: QueryShopDto): Promise<ItemsWithMeta<Product>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.baseQB();

    if (dto.q) {
      qb.andWhere('(p.title ILIKE :q OR p.description ILIKE :q)', {
        q: `%${dto.q}%`,
      });
    }
    if (dto.categoryId) {
      qb.andWhere('c.category_id = :cid', { cid: dto.categoryId });
    }
    if (dto.modelId) {
      qb.andWhere('m.phone_model_id = :mid', { mid: dto.modelId });
    }
    if (dto.priceMin !== undefined) {
      qb.andWhere('p.price >= :pmin', { pmin: dto.priceMin });
    }
    if (dto.priceMax !== undefined) {
      qb.andWhere('p.price <= :pmax', { pmax: dto.priceMax });
    }

    const sort = dto.sort ?? 'new';
    switch (sort) {
      case 'price':
        qb.orderBy('p.price', 'ASC');
        break;
      case '-price':
        qb.orderBy('p.price', 'DESC');
        break;
      case 'rating':
        qb.orderBy('p.avg_rating', 'ASC');
        break;
      case '-rating':
        qb.orderBy('p.avg_rating', 'DESC');
        break;
      case 'popular':
        qb.orderBy('p.view_count', 'ASC');
        break;
      case '-popular':
        qb.orderBy('p.view_count', 'DESC');
        break;
      case 'new':
        qb.orderBy('p.created_at', 'ASC');
        break;
      case '-new':
      default:
        qb.orderBy('p.created_at', 'DESC');
        break;
    }

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total } };
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.baseQB()
      .where('p.product_id = :id', { id })
      .getOne();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findOneWithUser(id: number, userId?: number) {
    const item = await this.findOne(id);
    let liked = false;
    let userRating: number | null = null;

    if (userId) {
      // типобезопасно проверяем наличие лайка
      const likedRow = await this.products.manager
        .createQueryBuilder()
        .select('COUNT(1)::int', 'cnt')
        .from('product_like', 'pl')
        .where('pl.product_id = :id AND pl.customer_id = :uid', {
          id,
          uid: userId,
        })
        .getRawOne<{ cnt: number }>();

      liked = (likedRow?.cnt ?? 0) > 0;

      const reviewRow = await this.products.manager
        .createQueryBuilder()
        .select('r.rating', 'rating')
        .from('review', 'r')
        .where('r.product_id = :id AND r.customer_id = :uid', {
          id,
          uid: userId,
        })
        .getRawOne<{ rating: number }>();

      userRating = reviewRow?.rating ?? null;
    }

    return { ...item, liked, userRating };
  }

  async getCategories(): Promise<Category[]> {
    return this.categories.find({ order: { name: 'ASC' } });
  }

  async getPhoneModels(): Promise<PhoneModel[]> {
    return this.models.find({ order: { brand: 'ASC', model: 'ASC' } });
  }
}
