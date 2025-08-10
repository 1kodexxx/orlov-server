import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ViewsService } from './views.service';
import { Request } from 'express';

type ReqWithUser = Request & { user?: { sub: number } };

@Injectable()
export class IncrementProductViewInterceptor implements NestInterceptor {
  constructor(private readonly views: ViewsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<ReqWithUser>();

    return next.handle().pipe(
      tap(() => {
        try {
          // id из params
          const idParam = req.params?.['id'];
          const id = idParam ? Number(idParam) : NaN;
          if (!Number.isFinite(id) || id <= 0) return;

          // IP
          const xff = req.headers['x-forwarded-for'];
          const xffStr: string | undefined = Array.isArray(xff) ? xff[0] : xff;
          const firstFromXff = xffStr?.split(',')[0]?.trim();
          const ip: string | null = firstFromXff || req.ip || null;

          // User-Agent
          const uah = req.headers['user-agent'] as
            | string
            | string[]
            | undefined;
          const ua: string | null = (Array.isArray(uah) ? uah[0] : uah) ?? null;

          const uid: number | null = req.user?.sub ?? null;

          // не ждём, запускаем побочный эффект
          void this.views.addView(id, uid, ip, ua);
        } catch {
          // не мешаем ответу
        }
      }),
    );
  }
}
