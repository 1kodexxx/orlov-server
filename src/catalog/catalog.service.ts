import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { QueryShopDto } from './dto/query-shop.dto';
import { SetRatingDto } from './dto/set-rating.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { Category } from './entities/category.entity';
import { PhoneModel } from './entities/phone-model.entity';

/** Строка из VIEW v_product_full (минимально нужное для каталога/карточки) */
export type ProductRow = {
  product_id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  view_count: number;
  like_count: number;
  avg_rating: number;
  created_at: string;
  updated_at: string;
  categories: string[];
  materials: string[];
  collections: string[];
  popularity: string[];
  images?: string[] | Array<{ url: string; position: number }>;
};

export type CommentRow = {
  id: number;
  text: string;
  created_at: string;
  userId: number;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type Paged<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type Kind = 'normal' | 'material' | 'collection' | 'popularity';
type MetaRow = { name: string; kind: Kind };

/** Владелец лайка: либо авторизованный пользователь, либо гость по visitorId */
type LikeOwner = { customerId?: number | null; visitorId?: string | null };

@Injectable()
export class CatalogService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(PhoneModel)
    private readonly models: Repository<PhoneModel>,
  ) {}

  private static toInt(x: unknown, fallback = 0): number {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  }

  private async recalcLikeCount(productId: number): Promise<void> {
    await this.ds.query(
      `UPDATE product
          SET like_count = (SELECT COUNT(*)::int FROM product_like pl WHERE pl.product_id = $1)
        WHERE product_id = $1`,
      [productId],
    );
  }

  /** Каталог с фильтрами/сортировкой (поверх VIEW v_product_full) */
  async findAll(dto: QueryShopDto): Promise<Paged<ProductRow>> {
    const {
      q,
      categories = [],
      materials = [],
      collections = [],
      popularity = [],
      priceMin,
      priceMax,
      sort = 'relevance',
      page = 1,
      limit = 24,
    } = dto;

    if (priceMin != null && priceMax != null && priceMin > priceMax) {
      throw new BadRequestException('priceMin must be ≤ priceMax');
    }

    const qb: SelectQueryBuilder<Record<string, any>> = this.ds
      .createQueryBuilder()
      .select('*')
      .from('v_product_full', 'vp');

    if (q?.trim()) {
      qb.andWhere('(vp.name ILIKE :q OR vp.description ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }
    if (priceMin != null) qb.andWhere('vp.price >= :priceMin', { priceMin });
    if (priceMax != null) qb.andWhere('vp.price <= :priceMax', { priceMax });

    const anyFrom = (values: string[], fieldSql: string) => {
      if (!values.length) return;
      qb.andWhere(
        `EXISTS (SELECT 1 FROM unnest(${fieldSql}) AS x(name) WHERE x.name = ANY(:v_${fieldSql}))`,
      ).setParameter(`v_${fieldSql}`, values);
    };

    anyFrom(categories, 'vp.categories');
    anyFrom(materials, 'vp.materials');
    anyFrom(collections, 'vp.collections');
    anyFrom(popularity, 'vp.popularity');

    switch (sort) {
      case 'name_asc':
        qb.orderBy('vp.name', 'ASC');
        break;
      case 'name_desc':
        qb.orderBy('vp.name', 'DESC');
        break;
      case 'price_asc':
        qb.orderBy('vp.price', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('vp.price', 'DESC');
        break;
      case 'rating_desc':
        qb.orderBy('vp.avg_rating', 'DESC');
        break;
      case 'rating_asc':
        qb.orderBy('vp.avg_rating', 'ASC');
        break;
      case 'views_desc':
        qb.orderBy('vp.view_count', 'DESC');
        break;
      case 'likes_desc':
        qb.orderBy('vp.like_count', 'DESC');
        break;
      case 'newest':
        qb.orderBy('vp.created_at', 'DESC');
        break;
      default:
        if (q?.trim()) {
          qb.addOrderBy(
            `POSITION(LOWER(:q2) IN LOWER(vp.name))`,
            'ASC',
            'NULLS LAST',
          ).setParameter('q2', q.trim());
        }
        qb.addOrderBy('vp.like_count', 'DESC')
          .addOrderBy('vp.view_count', 'DESC')
          .addOrderBy('vp.created_at', 'DESC');
    }

    const totalQb = this.ds
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('v_product_full', 'vp');
    totalQb.setParameters(qb.getParameters());
    (qb.expressionMap.wheres || []).forEach((w) =>
      totalQb.andWhere(w.condition),
    );

    const offset = (page - 1) * limit;

    const [itemsRaw, totalRaw] = await Promise.all([
      qb.limit(limit).offset(offset).getRawMany<ProductRow>(),
      totalQb.getRawOne<{ count: string }>(),
    ]);

    const items: ProductRow[] = itemsRaw;
    const total = CatalogService.toInt(totalRaw?.count, 0);

    return {
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Карточка товара (данные из v_product_full) */
  async findOne(id: number): Promise<ProductRow> {
    const row = await this.ds
      .createQueryBuilder()
      .select('*')
      .from('v_product_full', 'vp')
      .where('vp.product_id = :id', { id })
      .getRawOne<ProductRow | null>();

    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  /** Просмотры: всем (аноним/юзер). Уникальность ограничивается индексом в БД. */
  async addView(
    productId: number,
    customerId: number | null,
    visitorId: string | null,
    ip?: string | null,
    ua?: string | null,
  ): Promise<{ ok: true }> {
    await this.ds.query(
      `INSERT INTO product_view (product_id, customer_id, visitor_id, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (
         product_id,
         date_trunc('day', created_at),
         COALESCE(customer_id, -1),
         COALESCE(visitor_id, '00000000-0000-0000-0000-000000000000'::uuid)
       ) DO NOTHING`,
      [
        productId,
        customerId ?? null,
        visitorId ?? null,
        ip ?? null,
        ua ?? null,
      ],
    );
    return { ok: true };
  }

  /* ===================== ЛАЙКИ ===================== */

  /** Совместимость: лайк только авторизованным */
  async like(productId: number, userId: number): Promise<{ liked: true }> {
    await this.ds.query(
      `INSERT INTO product_like (product_id, customer_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [productId, userId],
    );
    await this.recalcLikeCount(productId);
    return { liked: true };
  }

  /** Совместимость: снять лайк только авторизованным */
  async unlike(productId: number, userId: number): Promise<{ liked: false }> {
    await this.ds.query(
      `DELETE FROM product_like WHERE product_id=$1 AND customer_id=$2`,
      [productId, userId],
    );
    await this.recalcLikeCount(productId);
    return { liked: false };
  }

  /** Публичный лайк: авторизованный или гость по visitorId. Идемпотентно. */
  async likePublic(
    productId: number,
    owner: LikeOwner,
  ): Promise<{ liked: true }> {
    const customerId = owner.customerId ?? null;
    const visitorId = owner.visitorId ?? null;
    if (!customerId && !visitorId) {
      throw new BadRequestException('owner required');
    }

    await this.ds.query(
      `INSERT INTO product_like(product_id, customer_id, visitor_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [productId, customerId, visitorId],
    );
    await this.recalcLikeCount(productId);
    return { liked: true };
  }

  /** Публичное снятие лайка. */
  async unlikePublic(
    productId: number,
    owner: LikeOwner,
  ): Promise<{ liked: false }> {
    const customerId = owner.customerId ?? null;
    const visitorId = owner.visitorId ?? null;

    await this.ds.query(
      `DELETE FROM product_like
        WHERE product_id = $1
          AND (customer_id = $2 OR visitor_id = $3)`,
      [productId, customerId, visitorId],
    );
    await this.recalcLikeCount(productId);
    return { liked: false };
  }

  /** Публичное избранное: если есть user — по нему, иначе — по visitorId */
  async getFavoritesPublic(owner: LikeOwner): Promise<ProductRow[]> {
    const customerId = owner.customerId ?? null;
    const visitorId = owner.visitorId ?? null;

    const rows = await this.ds.query<ProductRow[]>(
      `SELECT vp.*
         FROM product_like pl
         JOIN v_product_full vp ON vp.product_id = pl.product_id
        WHERE ($1::int  IS NOT NULL AND pl.customer_id = $1)
           OR ($2::uuid IS NOT NULL AND pl.visitor_id = $2)
        ORDER BY vp.created_at DESC`,
      [customerId, visitorId],
    );
    return rows;
  }

  /* ===================== РЕЙТИНГИ ===================== */

  async setRating(
    productId: number,
    userId: number,
    dto: SetRatingDto,
  ): Promise<{ rating: number }> {
    await this.ds.query(
      `INSERT INTO review (product_id, customer_id, rating, comment)
       VALUES ($1,$2,$3, NULLIF($4,'')) 
       ON CONFLICT (product_id, customer_id)
       DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment, review_date=now()`,
      [productId, userId, dto.rating, dto.comment ?? null],
    );
    return { rating: dto.rating };
  }

  async deleteRating(
    productId: number,
    userId: number,
  ): Promise<{ rating: null }> {
    await this.ds.query(
      `DELETE FROM review WHERE product_id=$1 AND customer_id=$2`,
      [productId, userId],
    );
    return { rating: null };
  }

  /* ===================== КОММЕНТАРИИ ===================== */

  async listComments(
    productId: number,
    page = 1,
    limit = 20,
  ): Promise<Paged<CommentRow>> {
    const itemsPromise = this.ds.query<CommentRow[]>(
      `SELECT 
         c.comment_id AS id,
         c.content     AS text,
         c.created_at,
         u.customer_id AS "userId",
         u.first_name  AS "firstName",
         u.last_name   AS "lastName",
         u.avatar_url  AS "avatarUrl"
       FROM comment c
       JOIN customer u ON u.customer_id = c.customer_id
       WHERE c.product_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, limit, (page - 1) * limit],
    );

    const totalPromise = this.ds
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('comment', 'c')
      .where('c.product_id=:id', { id: productId })
      .getRawOne<{ count: string }>();

    const [items, totalRaw] = await Promise.all([itemsPromise, totalPromise]);
    const total = CatalogService.toInt(totalRaw?.count, 0);

    return {
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async addComment(
    productId: number,
    userId: number,
    dto: AddCommentDto,
  ): Promise<CommentRow | undefined> {
    const rows = await this.ds.query<CommentRow[]>(
      `INSERT INTO comment (product_id, customer_id, content)
       VALUES ($1,$2,$3)
       RETURNING comment_id AS id, content AS text, created_at,
                 $2::int AS "userId", ''::text AS "firstName",
                 ''::text AS "lastName", NULL::text AS "avatarUrl"`,
      [productId, userId, dto.text],
    );
    return rows[0];
  }

  async deleteComment(
    commentId: number,
    userId: number,
  ): Promise<{ ok: true }> {
    await this.ds.query(
      `DELETE FROM comment WHERE comment_id=$1 AND customer_id=$2`,
      [commentId, userId],
    );
    return { ok: true };
  }

  /* ===================== МЕТАДАННЫЕ/СПРАВОЧНИКИ ===================== */

  async getMeta(): Promise<{
    categories: string[];
    materials: string[];
    collections: string[];
    popularity: string[];
  }> {
    const rows = await this.ds.query<MetaRow[]>(
      `SELECT name, kind FROM category ORDER BY kind, name`,
    );
    const pick = (k: Kind) =>
      rows.filter((r) => r.kind === k).map((r) => r.name);
    return {
      categories: pick('normal'),
      materials: pick('material'),
      collections: pick('collection'),
      popularity: pick('popularity'),
    };
  }

  getCategories = async (): Promise<Category[]> => {
    return this.categories.find({ order: { name: 'ASC' } });
  };

  getPhoneModels = async (): Promise<PhoneModel[]> => {
    return this.models.find({ order: { brand: 'ASC', modelName: 'ASC' } });
  };

  async userRatingFor(
    productId: number,
    userId: number,
  ): Promise<number | null> {
    const r = await this.ds.query<Array<{ rating: number }>>(
      `SELECT rating FROM review WHERE product_id=$1 AND customer_id=$2 LIMIT 1`,
      [productId, userId],
    );
    return r[0]?.rating ?? null;
  }

  async isLiked(productId: number, userId: number): Promise<boolean> {
    const r = await this.ds.query<Array<Record<string, never>>>(
      `SELECT 1 FROM product_like WHERE product_id=$1 AND customer_id=$2 LIMIT 1`,
      [productId, userId],
    );
    return r.length > 0;
  }
}
