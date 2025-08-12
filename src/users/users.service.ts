import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsSelect } from 'typeorm';
import { User } from './users.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sharp from 'sharp';
import * as argon2 from 'argon2';

/** Строка из v_product_full — достаточно полей, которые реально нужны в UI */
export interface VProductFullRow {
  product_id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  phone_model_id: number;
  view_count: number;
  like_count: number;
  avg_rating: number;
  created_at: string;
  updated_at: string;
  images: Array<{ url: string; position: number }>;
  categories: string[];
}

/** Строка “мой комментарий” */
export interface MyCommentRow {
  id: number; // comment_id
  text: string; // content
  createdAt: string; // created_at
  product_id: number;
  productName: string;
  productImage: string | null;
}

/** Строка “мой отзыв о компании” */
export interface MyCompanyReviewRow {
  id: string; // BIGINT -> string в node-pg
  rating: number;
  text: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  // --- ДОБАВЬ ЭТОТ ХЕЛПЕР НИЖЕ КОНСТРУКТОРА ИЛИ РЯДОМ С ДРУГИМИ МЕТОДАМИ ---
  /** Безопасная обёртка над manager.query с явным generic-типом результата */
  private async raw<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rows = await this.repo.manager.query(sql, params);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return rows as unknown as T[];
  }

  private baseSelect: FindOptionsSelect<User> = {
    id: true,
    email: true,
    role: true,
    firstName: true,
    lastName: true,
    phone: true,
    registeredAt: true,
    avatarUrl: true,
    tokenVersion: true,
    headline: true,
    organization: true,
  };

  async create(data: Partial<User>) {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async findById(id: number) {
    return this.repo.findOne({ where: { id }, select: this.baseSelect });
  }

  async findByEmail(email: string) {
    return this.repo.findOne({ where: { email }, select: this.baseSelect });
  }

  async findByEmailWithPassword(email: string) {
    return this.repo.findOne({
      where: { email },
      select: { ...this.baseSelect, passwordHash: true },
    });
  }

  async updateAvatar(userId: number, avatarUrl: string): Promise<void> {
    await this.repo.update({ id: userId }, { avatarUrl });
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    await this.repo.update({ id: userId }, dto);
    return this.findById(userId);
  }

  /** Смена email с проверкой уникальности + инвалидация токенов */
  async changeEmail(userId: number, newEmail: string) {
    const exists = await this.repo.findOne({
      where: { email: newEmail },
      select: { id: true },
    });
    if (exists && exists.id !== userId) {
      throw new ConflictException('Email already in use');
    }
    await this.repo.update({ id: userId }, { email: newEmail });
    await this.incrementTokenVersion(userId);
    return this.findById(userId);
  }

  async incrementTokenVersion(userId: number): Promise<void> {
    await this.repo.increment({ id: userId }, 'tokenVersion', 1);
  }

  async changePassword(
    userId: number,
    current: string,
    next: string,
  ): Promise<void> {
    if (current === next) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const user = await this.repo.findOne({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        tokenVersion: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const ok = await argon2.verify(user.passwordHash, current);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    const newHash = await argon2.hash(next, { type: argon2.argon2id });
    await this.repo.update({ id: userId }, { passwordHash: newHash });

    await this.repo.increment({ id: userId }, 'tokenVersion', 1);
  }

  async deleteById(id: number): Promise<void> {
    const user = await this.repo.findOne({ where: { id } });
    if (user?.avatarUrl?.startsWith('/static/avatars/')) {
      const uploadsRoot = path.join(process.cwd(), 'uploads');
      const oldFs = path.join(
        uploadsRoot,
        user.avatarUrl.replace('/static/', ''),
      );
      await safeUnlink(oldFs);
    }
    await this.repo.delete({ id });
  }

  /** Resize 256×256, webp, удаление старого файла, сохранение avatarUrl */
  async processAndSetAvatar(
    userId: number,
    tempPath: string,
  ): Promise<{ avatarUrl: string }> {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) {
      await safeUnlink(tempPath);
      throw new NotFoundException('User not found');
    }

    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const avatarsDir = path.join(uploadsRoot, 'avatars');
    await fs.mkdir(avatarsDir, { recursive: true });

    const filename = `u${userId}-${Date.now()}.webp`;
    const finalFsPath = path.join(avatarsDir, filename);
    const finalUrl = `/static/avatars/${filename}`;

    try {
      await sharp(tempPath)
        .rotate()
        .resize(256, 256, { fit: 'cover', position: 'attention' })
        .webp({ quality: 85 })
        .toFile(finalFsPath);
    } finally {
      await safeUnlink(tempPath);
    }

    if (user.avatarUrl?.startsWith('/static/avatars/')) {
      const oldFs = path.join(
        uploadsRoot,
        user.avatarUrl.replace('/static/', ''),
      );
      await safeUnlink(oldFs);
    }

    user.avatarUrl = finalUrl;
    await this.repo.save(user);

    return { avatarUrl: finalUrl };
  }

  /* ----------------- Личный кабинет: выборки ----------------- */

  /** Все товары, которые пользователь лайкнул */
  async getMyLikedProducts(userId: number): Promise<VProductFullRow[]> {
    return this.raw<VProductFullRow>(
      `SELECT vp.*
         FROM product_like pl
         JOIN v_product_full vp ON vp.product_id = pl.product_id
        WHERE pl.customer_id = $1
        ORDER BY vp.created_at DESC`,
      [userId],
    );
  }

  /** Все мои комментарии к товарам + базовая инфа о товаре */
  async getMyProductComments(userId: number): Promise<MyCommentRow[]> {
    return this.raw<MyCommentRow>(
      `SELECT c.comment_id AS id,
              c.content     AS text,
              c.created_at  AS "createdAt",
              vp.product_id,
              vp.name       AS "productName",
              (vp.images->0->>'url') AS "productImage"
         FROM comment c
         JOIN v_product_full vp ON vp.product_id = c.product_id
        WHERE c.customer_id = $1
        ORDER BY c.created_at DESC`,
      [userId],
    );
  }

  /** Все мои отзывы о компании (полные карточки) */
  async getMyCompanyReviews(userId: number): Promise<MyCompanyReviewRow[]> {
    return this.raw<MyCompanyReviewRow>(
      `SELECT id,
              rating,
              text,
              is_approved AS "isApproved",
              created_at  AS "createdAt",
              updated_at  AS "updatedAt"
         FROM company_reviews
        WHERE customer_id = $1
        ORDER BY created_at DESC`,
      [userId],
    );
  }
}

/* ----------------- helpers ----------------- */
function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return typeof e === 'object' && e !== null && 'code' in e;
}

async function safeUnlink(p?: string | null) {
  if (!p) return;
  try {
    await fs.unlink(p);
  } catch (e) {
    if (isErrnoException(e) && e.code === 'ENOENT') return;
    throw e;
  }
}
