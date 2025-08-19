import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import sharp from 'sharp';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './users.entity';

/** надёжный unlink с ретраями — лечит EBUSY/EPERM на Windows */
async function safeUnlink(
  p: string,
  retries = 5,
  delayMs = 120,
): Promise<void> {
  for (let i = 0; i <= retries; i += 1) {
    try {
      await fs.unlink(p);
      return;
    } catch (err) {
      const code = (err as { code?: unknown })?.code;
      const codeStr = typeof code === 'string' ? code : undefined;

      if (i === retries) return;
      if (codeStr === 'EBUSY' || codeStr === 'EPERM') {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      if (codeStr === 'ENOENT') return;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** Нормализация RU-телефона: +7XXXXXXXXXX */
function normalizeRuPhone(input: string): string {
  const digits = (input || '').replace(/\D+/g, '');
  if (digits.length === 11 && digits[0] === '8') return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('79')) return `+${digits}`;
  if (input.startsWith('+7') && digits.length === 11) return `+${digits}`;
  return `+7${digits.slice(-10)}`;
}

/** Что можно обновлять в профиле */
type ProfileUpdatable = DeepPartial<
  Pick<
    User,
    | 'firstName'
    | 'lastName'
    | 'phone'
    | 'country'
    | 'city'
    | 'homeAddress'
    | 'deliveryAddress'
    | 'headline'
    | 'organization'
    | 'birthDate'
    | 'pickupPoint'
  >
>;

/** Параметры для создания пользователя (используется auth.service) */
export type CreateUserInput = Pick<
  User,
  'email' | 'passwordHash' | 'role' | 'firstName' | 'lastName'
> &
  DeepPartial<
    Pick<
      User,
      | 'avatarUrl'
      | 'phone'
      | 'headline'
      | 'organization'
      | 'city'
      | 'country'
      | 'homeAddress'
      | 'deliveryAddress'
      | 'birthDate'
      | 'pickupPoint'
    >
  >;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  /** безопасная обёртка над manager.query без any */
  private async raw<T>(sql: string, params: unknown[] = []): Promise<T> {
    const resUnknown: unknown = await this.repo.manager.query(sql, params);
    return resUnknown as T;
  }

  // -------------------------------------------------
  // БАЗОВЫЕ МЕТОДЫ (для auth.module)
  // -------------------------------------------------

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repo.findOne({ where: { phone } });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'passwordHash',
        'role',
        'tokenVersion',
        'firstName',
        'lastName',
        'avatarUrl',
        'phone',
        'country',
        'city',
        'homeAddress',
        'deliveryAddress',
        'headline',
        'organization',
        'birthDate',
        'pickupPoint',
      ],
    });
  }

  /** Создать пользователя */
  async create(data: CreateUserInput): Promise<User> {
    const entity = this.repo.create({
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,

      phone: data.phone ? normalizeRuPhone(data.phone) : null,

      avatarUrl: data.avatarUrl ?? null,
      headline: data.headline ?? null,
      organization: data.organization ?? null,
      city: data.city ?? null,
      country: data.country ?? null,
      homeAddress: data.homeAddress ?? null,
      deliveryAddress: data.deliveryAddress ?? null,
      birthDate: data.birthDate ?? null,
      pickupPoint: data.pickupPoint ?? null,
    } as DeepPartial<User>);

    return this.repo.save(entity);
  }

  async incrementTokenVersion(userId: number): Promise<void> {
    await this.repo.increment({ id: userId }, 'tokenVersion', 1);
  }

  /** Публичная часть профиля */
  async getPublicProfile(userId: number) {
    const u = await this.repo.findOne({ where: { id: userId } });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      avatarUrl: u.avatarUrl ?? null,
      phone: u.phone ?? null,
      country: u.country ?? null,
      city: u.city ?? null,
      homeAddress: u.homeAddress ?? null,
      deliveryAddress: u.deliveryAddress ?? null,
      tokenVersion: u.tokenVersion ?? 0,
      headline: u.headline ?? null,
      organization: u.organization ?? null,
      birthDate: u.birthDate ?? null,
      pickupPoint: u.pickupPoint ?? null,
    };
  }

  // -------------------------------------------------
  // Личный кабинет
  // -------------------------------------------------

  /** Обновление анкеты в ЛК (+ проверка уникальности телефона) */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const data: ProfileUpdatable = {
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      country: dto.country ?? null,
      city: dto.city ?? null,
      homeAddress: dto.homeAddress ?? null,
      deliveryAddress: dto.deliveryAddress ?? null,
      headline: dto.headline ?? null,
      organization: dto.organization ?? null,
      birthDate: dto.birthDate ?? null,
      pickupPoint: dto.pickupPoint ?? null,
    };

    if (typeof dto.phone !== 'undefined') {
      if (dto.phone === null || dto.phone === '') {
        data.phone = null;
      } else {
        const normalized = normalizeRuPhone(dto.phone);
        if (!/^\+7\d{10}$/.test(normalized)) {
          throw new ConflictException(
            'Телефон должен быть российским номером (+7XXXXXXXXXX)',
          );
        }
        const existed = await this.findByPhone(normalized);
        if (existed && existed.id !== userId) {
          throw new ConflictException('Этот номер телефона уже используется');
        }
        data.phone = normalized;
      }
    }

    type UpdateArg = Parameters<Repository<User>['update']>[1];
    await this.repo.update({ id: userId }, data as UpdateArg);

    return this.getPublicProfile(userId);
  }

  /** Смена e-mail с проверкой уникальности */
  async changeEmail(userId: number, email: string) {
    const exists = await this.repo.findOne({
      where: { email },
      select: ['id'],
    });
    if (exists && exists.id !== userId) {
      throw new ConflictException('E-mail уже используется');
    }
    await this.repo.update({ id: userId }, { email });
    return { email };
  }

  /** Смена пароля (argon2) */
  async changePassword(userId: number, current: string, next: string) {
    if (!next || next.length < 6) {
      throw new UnauthorizedException('Новый пароль слишком короткий');
    }

    const user = await this.repo.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash'],
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const ok = await import('argon2').then((m) =>
      m.verify(user.passwordHash, current),
    );
    if (!ok) throw new UnauthorizedException('Текущий пароль неверный');

    const hashed = await import('argon2').then((m) => m.hash(next));
    type UpdateArg = Parameters<Repository<User>['update']>[1];
    await this.repo.update({ id: userId }, {
      passwordHash: hashed,
    } as UpdateArg);

    return { ok: true };
  }

  /** Загрузка/сжатие и установка аватара */
  async processAndSetAvatar(userId: number, srcPath: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const outDir = path.join(process.cwd(), 'uploads', 'avatars');
    await fs.mkdir(outDir, { recursive: true });

    const outName = `u${userId}-${Date.now()}.webp`;
    const outPath = path.join(outDir, outName);

    await sharp(srcPath)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 86 })
      .toFile(outPath)
      .finally(() => {
        void safeUnlink(srcPath);
      });

    // Удаляем предыдущий файл, если он был
    if (user.avatarUrl) {
      const relPrev = user.avatarUrl.replace(/^\/+/, '');
      const prevAbs = path.join(process.cwd(), relPrev);
      await safeUnlink(prevAbs);
    }

    const relWeb = `/uploads/avatars/${outName}`;

    type UpdateArg = Parameters<Repository<User>['update']>[1];
    await this.repo.update({ id: userId }, {
      avatarUrl: relWeb,
      avatarUpdatedAt: new Date(),
    } as UpdateArg);

    return { avatarUrl: relWeb };
  }

  // ===== ниже без изменений (мои заказы/статы/лайки/комменты/отзывы) =====

  async getMyOrders(userId: number) {
    const rows = await this.raw<
      Array<{
        id: string;
        date: string;
        price: string | number;
        status: string;
      }>
    >(
      `
      SELECT
        o.order_id::text   AS id,
        to_char(o.order_date, 'YYYY-MM-DD') AS date,
        o.total_amount::numeric(10,2)       AS price,
        o.status::text     AS status
      FROM orders o
      WHERE o.customer_id = $1
      ORDER BY o.order_date DESC
      LIMIT 100
      `,
      [userId],
    );

    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      price: Number(r.price),
      status: r.status,
    }));
  }

  async getMyStats(userId: number) {
    const [row] = await this.raw<
      Array<{
        orders_curr: number;
        orders_prev: number;
        likes_curr: number;
        likes_prev: number;
        rev_curr: number;
        rev_prev: number;
        canc_curr: number;
        canc_prev: number;
      }>
    >(
      `
      WITH
      orders_curr AS (
        SELECT COUNT(*)::int AS c
        FROM orders
        WHERE customer_id = $1 AND order_date >= now() - interval '90 days'
      ),
      orders_prev AS (
        SELECT COUNT(*)::int AS c
        FROM orders
        WHERE customer_id = $1
          AND order_date <  now() - interval '90 days'
          AND order_date >= now() - interval '180 days'
      ),
      likes_curr AS (
        SELECT COUNT(*)::int AS c
        FROM product_like
        WHERE customer_id = $1 AND liked_at >= now() - interval '90 days'
      ),
      likes_prev AS (
        SELECT COUNT(*)::int AS c
        FROM product_like
        WHERE customer_id = $1
          AND liked_at <  now() - interval '90 days'
          AND liked_at >= now() - interval '180 days'
      ),
      rev_curr AS (
        SELECT COUNT(*)::int AS c
        FROM company_reviews
        WHERE customer_id = $1 AND created_at >= now() - interval '90 days'
      ),
      rev_prev AS (
        SELECT COUNT(*)::int AS c
        FROM company_reviews
        WHERE customer_id = $1
          AND created_at <  now() - interval '90 days'
          AND created_at >= now() - interval '180 days'
      ),
      canc_curr AS (
        SELECT COUNT(*)::int AS c
        FROM orders
        WHERE customer_id = $1 AND status = 'cancelled'
          AND order_date >= now() - interval '90 days'
      ),
      canc_prev AS (
        SELECT COUNT(*)::int AS c
        FROM orders
        WHERE customer_id = $1 AND status = 'cancelled'
          AND order_date <  now() - interval '90 days'
          AND order_date >= now() - interval '180 days'
      )
      SELECT
        (SELECT c FROM orders_curr) AS orders_curr,
        (SELECT c FROM orders_prev) AS orders_prev,
        (SELECT c FROM likes_curr)  AS likes_curr,
        (SELECT c FROM likes_prev)  AS likes_prev,
        (SELECT c FROM rev_curr)    AS rev_curr,
        (SELECT c FROM rev_prev)    AS rev_prev,
        (SELECT c FROM canc_curr)   AS canc_curr,
        (SELECT c FROM canc_prev)   AS canc_prev
      `,
      [userId],
    );

    const pct = (curr: number, prev: number) =>
      prev === 0
        ? curr > 0
          ? 100
          : 0
        : Number((((curr - prev) / prev) * 100).toFixed(1));

    return {
      ordersMade: row.orders_curr,
      ordersChangePct: pct(row.orders_curr, row.orders_prev),
      favoritesAdded: row.likes_curr,
      favoritesChangePct: pct(row.likes_curr, row.likes_prev),
      reviewsAdded: row.rev_curr,
      reviewsChangePct: pct(row.rev_curr, row.rev_prev),
      returns: row.canc_curr,
      returnsChangePct: pct(row.canc_curr, row.canc_prev),
    };
  }

  async getMyLikedProducts(userId: number) {
    return this.raw<
      Array<{ id: number; name: string; price: number; image?: string | null }>
    >(
      `
      SELECT
        p.product_id AS id,
        p.name,
        p.price::numeric(10,2) AS price,
        (
          SELECT url
          FROM product_image i
          WHERE i.product_id = p.product_id
          ORDER BY position
          LIMIT 1
        ) AS image
      FROM product_like l
      JOIN product p ON p.product_id = l.product_id
      WHERE l.customer_id = $1
      ORDER BY l.liked_at DESC
      LIMIT 100
      `,
      [userId],
    );
  }

  async getMyProductComments(userId: number) {
    return this.raw<
      Array<{
        id: number;
        productId: number;
        productName: string;
        text: string;
        createdAt: string;
      }>
    >(
      `
      SELECT
        c.comment_id AS id,
        c.product_id AS "productId",
        p.name       AS "productName",
        c.content    AS text,
        to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt"
      FROM comment c
      JOIN product p ON p.product_id = c.product_id
      WHERE c.customer_id = $1
      ORDER BY c.created_at DESC
      LIMIT 200
      `,
      [userId],
    );
  }

  async getMyCompanyReviews(userId: number) {
    return this.raw<
      Array<{
        id: number;
        rating: number;
        text: string;
        createdAt: string;
        isApproved: boolean;
      }>
    >(
      `
      SELECT
        id,
        rating,
        text,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt",
        is_approved AS "isApproved"
      FROM company_reviews
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [userId],
    );
  }

  async deleteById(id: number) {
    await this.repo.delete({ id });
  }
}
