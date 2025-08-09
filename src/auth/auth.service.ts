import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types';

type PublicUser = {
  id: number;
  email: string;
  role: 'admin' | 'manager' | 'customer';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /** Регистрация нового пользователя + выпуск пары токенов. */
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
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'customer',
    });

    const { accessToken, refreshToken } = await this.issueTokens({
      id: created.id,
      email: created.email,
      role: created.role,
    });

    return {
      accessToken,
      refreshToken,
      user: { sub: created.id, email: created.email, role: created.role },
    };
  }

  /** Валидация пары email/пароль для LocalStrategy. */
  async validateUser(
    email: string,
    password: string,
  ): Promise<PublicUser | null> {
    // Берём пользователя с явной подгрузкой passwordHash
    const user = await this.users.findByEmailWithPassword(email);
    if (!user) return null;

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return null;

    return { id: user.id, email: user.email, role: user.role };
  }

  /** Выпуск access/refresh токенов. */
  async issueTokens(
    user: PublicUser,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      algorithm: 'RS256',
      privateKey: process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      algorithm: 'RS256',
      privateKey: process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
    });

    return { accessToken, refreshToken };
  }

  /** Удобный метод для контроллера логина. */
  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user);
  }
}
