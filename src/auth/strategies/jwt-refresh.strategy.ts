// src/auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { JwtPayload } from '../types';
import { UsersService } from '../../users/users.service';

type RequestWithCookies = Request & {
  cookies?: Record<string, string>;
};

function rtFromCookies(req?: RequestWithCookies): string | null {
  if (!req || !req.cookies) return null;
  const val = req.cookies['rt'] as string | undefined;
  return typeof val === 'string' ? val : null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly users: UsersService) {
    const publicKey = (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1) Bearer (на всякий случай)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // 2) httpOnly cookie rt
        (req: RequestWithCookies) => rtFromCookies(req),
      ]),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: publicKey,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.users.findById(payload.sub);
    if (!user || (user.tokenVersion ?? 0) !== payload.ver) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
