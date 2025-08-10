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
} from './guards/index';
import { JwtPayload, isJwtPayload, PublicUser } from './types';

type ReqWithMaybeUser = Request & { user?: JwtPayload };

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
    if (!isJwtPayload(req.user)) throw new UnauthorizedException();

    const p = req.user;
    const { accessToken, refreshToken } = await this.auth.issueTokens({
      id: p.sub,
      email: p.email,
      role: p.role,
      tokenVersion: p.ver,
    } satisfies PublicUser);

    res.cookie('rt', refreshToken, {
      ...RT_COOKIE_OPTS,
      maxAge: 7 * 24 * 3600 * 1000,
    });
    return { accessToken, user: p };
  }

  @UseGuards(JwtRefreshGuard, RefreshOriginGuard)
  @Post('refresh')
  async refresh(
    @Req() req: ReqWithMaybeUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!isJwtPayload(req.user)) throw new UnauthorizedException();

    const p = req.user;
    const { accessToken, refreshToken } = await this.auth.issueTokens({
      id: p.sub,
      email: p.email,
      role: p.role,
      tokenVersion: p.ver,
    });

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
    await this.auth.logout(req.user.sub, req.user.jti);
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
    const profile = await this.auth.getProfile(req.user.sub);
    return { user: profile };
  }
}
