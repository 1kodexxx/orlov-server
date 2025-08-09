// src/auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  JwtFromRequestFunction,
  StrategyOptions,
} from 'passport-jwt';
import type { Request } from 'express';
import { JwtPayload } from '../types';
import { UsersService } from '../../users/users.service';

const extractFromCookie: JwtFromRequestFunction = (req: Request) => {
  const cookies: unknown = (req as { cookies?: unknown }).cookies;
  if (
    cookies &&
    typeof cookies === 'object' &&
    'rt' in cookies &&
    typeof (cookies as Record<string, unknown>).rt === 'string'
  ) {
    return (cookies as Record<string, string>).rt;
  }
  return null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly users: UsersService) {
    const opts: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n'),
    };
    super(opts);
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    if ((user.tokenVersion ?? 0) !== payload.ver) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
