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
import { Response, Request } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard, JwtAuthGuard, JwtRefreshGuard } from './guards';
import { JwtPayload, isJwtPayload } from './types';

// user в запросе либо отсутствует, либо это уже JwtPayload
type ReqWithMaybeUser = Request & { user?: JwtPayload };

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
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // в проде: true + sameSite: 'none'
      maxAge: 7 * 24 * 3600 * 1000,
    });

    return { accessToken, user };
  }

  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: ReqWithMaybeUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1) Берём payload, который положила LocalStrategy
    let pub: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;

    // 2) Если почему-то его нет — валидируем и собираем сами
    if (!pub) {
      const u = await this.auth.validateUser(dto.email, dto.password);
      if (!u) throw new UnauthorizedException();
      pub = { sub: u.id, email: u.email, role: u.role };
      req.user = pub; // кладём для единообразия по пайплайну
    }

    const { accessToken, refreshToken } = await this.auth.issueTokens({
      id: pub.sub,
      email: pub.email,
      role: pub.role,
    });

    res.cookie('rt', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 3600 * 1000,
    });

    return { accessToken, user: pub };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(
    @Req() req: ReqWithMaybeUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!isJwtPayload(req.user)) {
      throw new UnauthorizedException();
    }
    // после guard'а тип уже JwtPayload — каст не нужен
    const payload = req.user;

    const { accessToken, refreshToken } = await this.auth.issueTokens({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    });

    res.cookie('rt', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 3600 * 1000,
    });

    return { accessToken, user: payload };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('rt');
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: ReqWithMaybeUser) {
    return isJwtPayload(req.user) ? { user: req.user } : { user: null };
  }
}
