// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import type { Response, Request } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  LocalAuthGuard,
  JwtAuthGuard,
  JwtRefreshGuard,
  RefreshOriginGuard,
} from './guards';
import { isJwtPayload, PublicUser, isPublicUser } from './types';

type ReqWithMaybeUser = Request & {
  user?: unknown;
  cookies?: Record<string, string>;
};

// Базовые опции для refresh-cookie
const RT_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const, // PROD: 'none' (и secure: true)
  secure: false, // PROD: true
  path: '/',
};

// helper: применить remember → задать maxAge (30 дней) или оставить сеансовой
function applyRemember(res: Response, token: string, remember: boolean) {
  if (remember) {
    // длительная cookie + флажок rtp=1, чтобы на /refresh понимать режим
    res.cookie('rt', token, {
      ...RT_COOKIE_OPTS,
      maxAge: 30 * 24 * 3600 * 1000,
    });
    res.cookie('rtp', '1', {
      ...RT_COOKIE_OPTS,
      maxAge: 30 * 24 * 3600 * 1000,
    });
  } else {
    // сеансовая cookie, флажок удаляем
    res.cookie('rt', token, { ...RT_COOKIE_OPTS }); // без maxAge → session
    res.cookie('rtp', '', {
      ...RT_COOKIE_OPTS,
      maxAge: 0,
      expires: new Date(0),
    });
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Query('remember') rememberQuery?: string,
  ) {
    // Можно регистрироваться сразу с remember=1 (необязательно)
    const remember =
      rememberQuery === '1' ||
      rememberQuery === 'true' ||
      rememberQuery === 'on';

    const { accessToken, refreshToken, user } = await this.auth.register(dto);

    applyRemember(res, refreshToken, remember);

    return { accessToken, user };
  }

  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() _dto: LoginDto,
    @Req() req: ReqWithMaybeUser,
    @Res({ passthrough: true }) res: Response,
    @Query('remember') rememberQuery?: string,
  ) {
    // LocalStrategy кладёт PublicUser в req.user
    const u = req.user;
    if (!isPublicUser(u)) throw new UnauthorizedException();

    const { accessToken, refreshToken } = await this.auth.issueTokens(
      u as PublicUser,
    );

    const remember =
      rememberQuery === '1' ||
      rememberQuery === 'true' ||
      rememberQuery === 'on';

    applyRemember(res, refreshToken, remember);

    return { accessToken, user: u };
  }

  @UseGuards(JwtRefreshGuard, RefreshOriginGuard)
  @Post('refresh')
  async refresh(
    @Req() req: ReqWithMaybeUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!isJwtPayload(req.user)) throw new UnauthorizedException();
    const p = req.user; // JwtPayload после type guard

    const { accessToken, refreshToken } = await this.auth.issueTokens({
      id: p.sub,
      email: p.email,
      role: p.role,
      tokenVersion: p.ver,
    } as PublicUser);

    // читаем флажок режима (поставлен на login/register)
    const remember = req.cookies?.rtp === '1';
    applyRemember(res, refreshToken, remember);

    return { accessToken, user: p };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: ReqWithMaybeUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!isJwtPayload(req.user)) throw new UnauthorizedException();
    const p = req.user; // JwtPayload

    await this.auth.logout(p.sub, p.jti);

    // чистим и сам refresh, и флажок persist
    res.cookie('rt', '', {
      ...RT_COOKIE_OPTS,
      maxAge: 0,
      expires: new Date(0),
    });
    res.cookie('rtp', '', {
      ...RT_COOKIE_OPTS,
      maxAge: 0,
      expires: new Date(0),
    });

    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: ReqWithMaybeUser) {
    if (!isJwtPayload(req.user)) return { user: null };
    const p = req.user; // JwtPayload
    const profile = await this.auth.getProfile(p.sub);
    return { user: profile };
  }
}
