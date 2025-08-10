// src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload, PublicUser } from './types';
import { BlacklistService } from '../common/blacklist/blacklist.service';

function parseTtlSeconds(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const m = /^(\d+)([smhd])?$/.exec(v.trim());
  if (!m) return fallback;
  const n = Number(m[1]);
  const u = m[2] ?? 's';
  const mult = u === 's' ? 1 : u === 'm' ? 60 : u === 'h' ? 3600 : 86400;
  return n * mult;
}

@Injectable()
export class AuthService {
  private readonly accessTtlSec = parseTtlSeconds(
    process.env.JWT_ACCESS_TTL,
    15 * 60,
  );

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly blacklist: BlacklistService,
  ) {}

  /** Регистрация нового пользователя + выпуск пары токенов */
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

    const created = await this.users.create({
      email: dto.email,
      passwordHash,
      role: 'customer',
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    const pub: PublicUser = {
      id: created.id,
      email: created.email,
      role: created.role,
      tokenVersion: created.tokenVersion ?? 0,
    };

    const { accessToken, refreshToken, payload } = await this.issueTokens(pub);
    return { accessToken, refreshToken, user: payload };
  }

  /** Проверка логина/пароля, возвращает публичного пользователя */
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

  /**
   * Выпуск access/refresh (RS256).
   * jti генерируем и передаём ТОЛЬКО через опцию `jwtid`, в payload его не кладём.
   */
  async issueTokens(user: PublicUser): Promise<{
    accessToken: string;
    refreshToken: string;
    payload: JwtPayload; // вернём payload с jti для удобства
  }> {
    const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privateKey) throw new Error('JWT_PRIVATE_KEY is missing');

    const base: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ver: user.tokenVersion,
    };

    const jti = randomUUID();

    const accessToken = await this.jwt.signAsync(base, {
      algorithm: 'RS256',
      privateKey,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
      jwtid: jti, // <- этого достаточно: claim jti окажется в токене
    });

    const refreshToken = await this.jwt.signAsync(base, {
      algorithm: 'RS256',
      privateKey,
      expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
    });

    // Вернём payload с jti (удобно прокинуть дальше в контроллер)
    return { accessToken, refreshToken, payload: { ...base, jti } };
  }

  /** Профиль текущего пользователя */
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

  /**
   * Жёсткий выход:
   *  - ++tokenVersion (ломаем refresh)
   *  - кладём текущий access.jti в blacklist до истечения TTL
   */
  async logout(userId: number, currentJti?: string) {
    await this.users.incrementTokenVersion(userId);
    if (currentJti) {
      this.blacklist.add(currentJti, this.accessTtlSec); // sync
    }
  }
}
