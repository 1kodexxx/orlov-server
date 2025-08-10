// src/auth/guards/origin.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/** Разрешаем refresh только с Origin/Referer из белого списка CORS_ORIGINS. */
@Injectable()
export class RefreshOriginGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const origin = (req.headers.origin ?? '').toString();
    const referer = (req.headers.referer ?? '').toString();

    const whitelist = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const isProd = process.env.NODE_ENV === 'production';

    // В dev допускаем отсутствие заголовков (Postman/curl)
    if (!isProd && !origin && !referer) return true;

    const okByOrigin = origin && whitelist.includes(origin);
    const okByReferer = referer && whitelist.some((o) => referer.startsWith(o));

    if (okByOrigin || okByReferer) return true;
    throw new ForbiddenException('Bad origin');
  }
}
