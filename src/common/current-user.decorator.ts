import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: number;
  email: string;
  role: 'admin' | 'manager' | 'customer';
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

/** Возвращает весь объект user (payload), который положил Guard/Passport */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return req.user;
  },
);

/** Только id пользователя */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return req.user?.id;
  },
);
