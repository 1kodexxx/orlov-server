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

type ReqWithMaybeUser = Request & { user?: unknown };

const RT_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const, // PROD: 'none'
  secure: false, // PROD: true
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.register(dto);
    res.cookie('rt', refreshToken, {
      ...RT_COOKIE_OPTS,
      maxAge: 7 * 24 * 3600 * 1000,
    });
    return { accessToken, user };
  }

  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() _dto: LoginDto,
    @Req() req: ReqWithMaybeUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    // LocalStrategy кладёт PublicUser в req.user
    const u = req.user;
    if (!isPublicUser(u)) throw new UnauthorizedException();

    const { accessToken, refreshToken } = await this.auth.issueTokens(u);

    res.cookie('rt', refreshToken, {
      ...RT_COOKIE_OPTS,
      maxAge: 7 * 24 * 3600 * 1000,
    });

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

    res.cookie('rt', refreshToken, {
      ...RT_COOKIE_OPTS,
      maxAge: 7 * 24 * 3600 * 1000,
    });
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
    res.cookie('rt', '', {
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
