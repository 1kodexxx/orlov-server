import { Injectable, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { JwtPayload } from './types';

type PublicUser = Pick<User, 'id' | 'email' | 'role'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ accessToken: string; refreshToken: string; user: JwtPayload }> {
    const existed = await this.users.findByEmail(data.email);
    if (existed) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
    });
    const created = await this.users.create({ ...data, passwordHash });

    // выпускаем токены на свежесозданного пользователя
    return this.issueTokens({
      id: created.id,
      email: created.email,
      role: created.role,
    });
  }

  /** Возвращает публичного пользователя или null */
  async validateUser(
    email: string,
    password: string,
  ): Promise<PublicUser | null> {
    const user = await this.users.findByEmail(email);
    if (!user) return null;

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return null;

    return { id: user.id, email: user.email, role: user.role };
  }

  /** Выпускаем пару токенов для публичного пользователя */
  async issueTokens(user: PublicUser): Promise<{
    accessToken: string;
    refreshToken: string;
    user: JwtPayload;
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const access = await this.jwt.signAsync(payload, {
      algorithm: 'RS256',
      privateKey: process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });

    const refresh = await this.jwt.signAsync(payload, {
      algorithm: 'RS256',
      privateKey: process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
    });

    return { accessToken: access, refreshToken: refresh, user: payload };
  }
}
