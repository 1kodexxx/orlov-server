import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsSelect } from 'typeorm';
import { User } from './users.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
    await this.repo.delete({ id });
  }
}
