import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '../auth/types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
  }

  async create(data: Partial<User> & { passwordHash: string; role?: Role }) {
    const user = this.repo.create({
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      email: data.email!,
      phone: data.phone,
      passwordHash: data.passwordHash,
      role: data.role ?? 'customer',
      registeredAt: new Date(),
    });
    return this.repo.save(user);
  }

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }
}
