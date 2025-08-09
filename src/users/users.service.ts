import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { User } from './user.entity';
import { Role } from '../auth/types';
import { UpdateProfileDto } from './dto/update-profile.dto';

import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  /** Создаёт пользователя (passwordHash уже должен быть посчитан снаружи). */
  async create(data: {
    firstName?: string;
    lastName?: string;
    email: string;
    passwordHash: string;
    phone?: string | null;
    role?: Role;
  }): Promise<User> {
    const payload: DeepPartial<User> = {
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      email: data.email,
      phone: data.phone ?? null,
      registeredAt: new Date(),
      passwordHash: data.passwordHash,
      role: (data.role ?? 'customer') as User['role'],
    };

    const entity = this.repo.create(payload);
    return this.repo.save(entity);
  }

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  /**
   * ВАЖНО: passwordHash имеет select:false в entity,
   * поэтому здесь его явно добавляем в SELECT.
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
  }

  /** Бросает 404, если пользователя нет. */
  private async mustGet(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  /** Профиль: обновление имени/телефона. */
  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<User> {
    await this.repo.update(userId, dto);
    return this.mustGet(userId);
  }

  /**
   * Безопасно преобразует публичный URL (/static/avatars/xxx.webp)
   * в абсолютный путь внутри папки uploads. Возвращает null, если URL не наш.
   */
  private resolveUploadPathFromPublicUrl(url: string | null): string | null {
    if (!url) return null;
    // принимаем только URL внутри /static/**
    if (!url.startsWith('/static/')) return null;
    const relative = url.replace(/^\/static\//, ''); // avatars/xxx.webp
    // собираем абсолютный путь
    const abs = path.resolve(process.cwd(), 'uploads', relative);
    // гарантируем, что путь внутри папки uploads (защита от traversal)
    const uploadsRoot = path.resolve(process.cwd(), 'uploads') + path.sep;
    if (!abs.startsWith(uploadsRoot)) return null;
    return abs;
  }

  /**
   * Устанавливает новый avatarUrl. Старый файл удаляется ПОСЛЕ успешного сохранения
   * нового значения в БД, чтобы не остаться без аватара при сбое save().
   */
  async setAvatar(userId: number, newPublicUrl: string | null): Promise<User> {
    const user = await this.mustGet(userId);

    const oldPublicUrl = user.avatarUrl ?? null;
    const oldFilePath = this.resolveUploadPathFromPublicUrl(oldPublicUrl);

    // обновляем запись
    user.avatarUrl = newPublicUrl;
    user.avatarUpdatedAt = newPublicUrl ? new Date() : null;
    const saved = await this.repo.save(user);

    // пробуем удалить старый файл уже после успешного save()
    if (oldFilePath) {
      try {
        await fs.promises.unlink(oldFilePath);
      } catch {
        // игнорируем: файл мог уже отсутствовать — не критично
      }
    }

    return saved;
  }

  /** Удаляет текущий аватар (и файл), очищает поля. */
  async removeAvatar(userId: number): Promise<User> {
    return this.setAvatar(userId, null);
  }
}
