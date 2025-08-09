// src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload, PublicUser } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: JwtPayload;
  }> {
    const existed = await this.users.findByEmail(dto.email);
    if (existed) throw new BadRequestException('Email already registered');

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    // Вставляем только реально заданные поля
    const data: Parameters<UsersService['create']>[0] = {
      email: dto.email,
      passwordHash,
      role: 'customer',
    };
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;

    const created = await this.users.create(data);

    const pub: PublicUser = {
      id: created.id,
      email: created.email,
      role: created.role,
      tokenVersion: created.tokenVersion ?? 0,
    };

    const { accessToken, refreshToken } = await this.issueTokens(pub);

    return {
      accessToken,
      refreshToken,
      user: {
        sub: pub.id,
        email: pub.email,
        role: pub.role,
        ver: pub.tokenVersion,
      },
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<PublicUser | null> {
    const user = await this.users.findByEmailWithPassword(email);
    if (!user) return null;

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    };
  }

  /** ВЫПУСК ТОКЕНОВ — RS256 + PRIVATE KEY */
  async issueTokens(
    user: PublicUser,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ver: user.tokenVersion,
    };

    const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privateKey) {
      throw new Error('JWT_PRIVATE_KEY is missing');
    }

    const accessToken = await this.jwt.signAsync(payload, {
      algorithm: 'RS256',
      privateKey,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      algorithm: 'RS256',
      privateKey,
      expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
    });

    return { accessToken, refreshToken };
  }

  async getProfile(userId: number) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  }

  async logout(userId: number) {
    await this.users.incrementTokenVersion(userId);
  }
}
