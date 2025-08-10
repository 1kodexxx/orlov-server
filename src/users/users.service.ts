// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsSelect } from 'typeorm';
import { User } from './users.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sharp from 'sharp';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

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

  async incrementTokenVersion(userId: number): Promise<void> {
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
      // удаляем исходник в любом случае
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
}

/** Type guard для NodeJS.ErrnoException */
function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return typeof e === 'object' && e !== null && 'code' in e;
}

/** Безопасное удаление файла: игнорируем ENOENT, остальное пробрасываем */
async function safeUnlink(p?: string | null) {
  if (!p) return;
  try {
    await fs.unlink(p);
  } catch (e) {
    if (isErrnoException(e) && e.code === 'ENOENT') return;
    throw e;
  }
}
