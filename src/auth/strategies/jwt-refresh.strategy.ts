import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  JwtFromRequestFunction,
  StrategyOptions,
} from 'passport-jwt';
import type { Request } from 'express';
import { JwtPayload } from './jwt-access.strategy';

// Явно типизируем extractor (чтобы не было any)
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
  constructor() {
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

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
