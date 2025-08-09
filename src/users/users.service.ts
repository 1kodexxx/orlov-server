import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { User } from './user.entity';
import { Role } from '../auth/types';

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
    // Явно укажем DeepPartial<User>, чтобы не срабатывала перегрузка под массив
    const payload: DeepPartial<User> = {
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      email: data.email,
      phone: data.phone ?? null,
      registeredAt: new Date(),
      passwordHash: data.passwordHash,
      role: data.role ?? 'customer',
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
      .addSelect('u.passwordHash') // <- ключевой фикс
      .where('u.email = :email', { email })
      .getOne();
  }
}
