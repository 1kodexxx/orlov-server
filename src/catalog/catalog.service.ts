import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';

import { QueryShopDto } from './dto/query-shop.dto';
import { SetRatingDto } from './dto/set-rating.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { Category } from './entities/category.entity';
import { PhoneModel } from './entities/phone-model.entity';

/** Строка из VIEW v_product_full */
export type ProductRow = {
  product_id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  view_count: number;
  like_count: number;
  avg_rating: number;
  material: 'Кожа' | 'Металл' | 'Силикон';
  popularity: 'hit' | 'new' | 'recommended';
  collection: 'business' | 'limited' | 'premium' | 'autumn2025';
  created_at: string;
  updated_at: string;
  categories: string[];
  materials: string[];
  collections: string[];
  popularity_arr?: string[];
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
type RatingOwner = { customerId: number | null; visitorId: string | null };

/* ===== соответствие slug → русский ярлык (для обратной совместимости данных) ===== */
const slugToLabel: Record<string, string> = {
  men: 'Мужчинам',
  women: 'Женщинам',
  patriots: 'Патриотам',
  government: 'Гос.служащим',
  business: 'Для бизнеса',
  premium: 'Премиум',
  cultural: 'Культурный код',
  imperial: 'Имперский стиль',
  orthodoxy: 'Православие',
  history: 'История',
  ussr: 'СССР',
};

@Injectable()
export class CatalogService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
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

  private async recalcViewCount(productId: number): Promise<void> {
    await this.ds.query(
      `UPDATE product
          SET view_count = (SELECT COUNT(*)::int FROM product_view pv WHERE pv.product_id = $1)
        WHERE product_id = $1`,
      [productId],
    );
  }

  /** Каталог с фильтрами/поиском/сортировкой */
  async findAll(dto: QueryShopDto): Promise<Paged<ProductRow>> {
    const {
      q,
      category,
      categories: categoriesParam = [],
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

    // слуги категорий (OR-логика)
    const categorySlugs = [...categoriesParam, ...(category ? [category] : [])];

    // русские ярлыки для обратной совместимости (если slug ещё не заполнен в БД)
    const categoryLabels = categorySlugs
      .map((s) => slugToLabel[s])
      .filter(Boolean);

    const qb: SelectQueryBuilder<Record<string, any>> = this.ds
      .createQueryBuilder()
      .select('*')
      .from('v_product_full', 'vp');

    // Поиск
    if (q?.trim()) {
      qb.andWhere('(vp.name ILIKE :q OR vp.description ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    // Диапазон цены
    if (priceMin != null) qb.andWhere('vp.price >= :priceMin', { priceMin });
    if (priceMax != null) qb.andWhere('vp.price <= :priceMax', { priceMax });

    // Простые фильтры
    if (materials.length)
      qb.andWhere('vp.material = ANY(:mats)', { mats: materials });
    if (collections.length)
      qb.andWhere('vp.collection = ANY(:cols)', { cols: collections });
    if (popularity.length)
      qb.andWhere('vp.popularity = ANY(:pops)', { pops: popularity });

    // ===== ФИЛЬТР ПО КАТЕГОРИЯМ =====
    if (categorySlugs.length) {
      // 1) правильный путь — по slug
      // 2) fallback — по русскому имени (если slug ещё пуст)
      qb.andWhere(
        `
        EXISTS (
          SELECT 1
            FROM product_category pc
            JOIN category c ON c.category_id = pc.category_id
           WHERE pc.product_id = vp.product_id
             AND (
                  c.slug = ANY(:slugs)
               OR (:labelsLen > 0 AND c.name = ANY(:labels))
             )
        )
      `,
        {
          slugs: categorySlugs,
          labels: categoryLabels,
          labelsLen: categoryLabels.length,
        },
      );
    }

    // Сортировка
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

    // Пагинация + COUNT
    const offset = (page - 1) * limit;

    const totalQb = this.ds
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('v_product_full', 'vp');

    totalQb.setParameters(qb.getParameters());
    (qb.expressionMap.wheres || []).forEach((w) =>
      totalQb.andWhere(w.condition),
    );

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

  /** Карточка товара */
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

  /* ===================== ПРОСМОТРЫ ===================== */
  async addView(
    optsProductId: number,
    opts: {
      customerId?: number | null;
      visitorId?: string | null;
      ip?: string | null;
      userAgent?: string | null;
    },
  ): Promise<void> {
    const {
      customerId = null,
      visitorId = null,
      ip = null,
      userAgent = null,
    } = opts;

    await this.ds.query(
      `
      INSERT INTO product_view (product_id, customer_id, visitor_id, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (
        product_id,
        COALESCE(customer_id, -1),
        COALESCE(visitor_id, '00000000-0000-0000-0000-000000000000'::uuid),
        viewed_date
      )
      DO NOTHING
      `,
      [optsProductId, customerId, visitorId, ip, userAgent],
    );

    await this.recalcViewCount(optsProductId);
  }

  /* ===================== ЛАЙКИ ===================== */

  async likePublic(
    productId: number,
    owner: LikeOwner,
  ): Promise<{ liked: true; likeCount: number }> {
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

    const cnt = await this.ds.query<{ c: string }[]>(
      `SELECT like_count AS c FROM product WHERE product_id=$1 LIMIT 1`,
      [productId],
    );
    return { liked: true, likeCount: Number(cnt[0]?.c ?? 0) };
  }

  async unlikePublic(
    productId: number,
    owner: LikeOwner,
  ): Promise<{ liked: false; likeCount: number }> {
    const customerId = owner.customerId ?? null;
    const visitorId = owner.visitorId ?? null;

    await this.ds.query(
      `DELETE FROM product_like
        WHERE product_id = $1
          AND (customer_id = $2 OR visitor_id = $3)`,
      [productId, customerId, visitorId],
    );
    await this.recalcLikeCount(productId);
    const cnt = await this.ds.query<{ c: string }[]>(
      `SELECT like_count AS c FROM product WHERE product_id=$1 LIMIT 1`,
      [productId],
    );
    return { liked: false, likeCount: Number(cnt[0]?.c ?? 0) };
  }

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

  /* ===================== РЕЙТИНГИ (user || visitor) ===================== */

  async setRatingPublic(
    productId: number,
    owner: RatingOwner,
    dto: SetRatingDto,
  ): Promise<{ avgRating: number; myRating: number }> {
    const { customerId, visitorId } = owner;
    if (!customerId && !visitorId)
      throw new BadRequestException('owner required');

    if (customerId) {
      await this.ds.query(
        `INSERT INTO review (product_id, customer_id, visitor_id, rating, comment)
         VALUES ($1, $2, NULL, $3, NULLIF($4,''))
         ON CONFLICT (product_id, customer_id)
         DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment, review_date=now()`,
        [productId, customerId, dto.rating, dto.comment ?? null],
      );
    } else {
      await this.ds.query(
        `INSERT INTO review (product_id, customer_id, visitor_id, rating, comment)
         VALUES ($1, NULL, $2, $3, NULLIF($4,''))
         ON CONFLICT (product_id, visitor_id)
         DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment, review_date=now()`,
        [productId, visitorId, dto.rating, dto.comment ?? null],
      );
    }

    const avgRow = await this.ds.query<{ avg: string }[]>(
      `SELECT COALESCE(ROUND(AVG(rating)::numeric,2),0.00) AS avg FROM review WHERE product_id=$1`,
      [productId],
    );
    const myRow = await this.ds.query<{ r?: number }[]>(
      `
      SELECT rating AS r FROM review
       WHERE product_id=$1
         AND (
           ($2::int  IS NOT NULL AND customer_id=$2)
           OR
           ($3::uuid IS NOT NULL AND visitor_id=$3)
         )
       LIMIT 1
      `,
      [productId, customerId ?? null, visitorId ?? null],
    );

    return {
      avgRating: Number(avgRow[0]?.avg ?? 0),
      myRating: Number(myRow[0]?.r ?? 0) || 0,
    };
  }

  async deleteRatingPublic(
    productId: number,
    owner: RatingOwner,
  ): Promise<{ avgRating: number; myRating: 0 }> {
    const { customerId, visitorId } = owner;
    await this.ds.query(
      `
      DELETE FROM review
       WHERE product_id=$1
         AND (
           ($2::int  IS NOT NULL AND customer_id=$2)
           OR
           ($3::uuid IS NOT NULL AND visitor_id=$3)
         )`,
      [productId, customerId ?? null, visitorId ?? null],
    );

    const avgRow = await this.ds.query<{ avg: string }[]>(
      `SELECT COALESCE(ROUND(AVG(rating)::numeric,2),0.00) AS avg FROM review WHERE product_id=$1`,
      [productId],
    );

    return { avgRating: Number(avgRow[0]?.avg ?? 0), myRating: 0 };
  }

  /* ===================== КОММЕНТАРИИ ===================== */

  async listComments(
    productId: number,
    page = 1,
    limit = 20,
  ): Promise<{
    items: CommentRow[];
    page: number;
    limit: number;
    total: number;
    pages: number;
  }> {
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

  /* ===================== МЕТА ===================== */

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
      materials: ['Кожа', 'Металл', 'Силикон'],
      collections: ['business', 'limited', 'premium', 'autumn2025'],
      popularity: ['hit', 'new', 'recommended'],
    };
  }

  // Вспомогательные справочники, если нужно
  getCategories = async (): Promise<Category[]> =>
    this.categories.find({ order: { name: 'ASC' } });

  getPhoneModels = async (): Promise<PhoneModel[]> =>
    this.models.find({ order: { brand: 'ASC', modelName: 'ASC' } });

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
