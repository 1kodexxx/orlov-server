// src/auth/guards/jwt-optional.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export type JwtUser = {
  sub: number;
  email: string;
  role: 'admin' | 'manager' | 'customer';
};

/** Опциональный guard: не бросает 401 — вернёт user | undefined */
@Injectable()
export class JwtOptionalAuthGuard extends AuthGuard('jwt') {
  override handleRequest(
    // сигнатура совместима с базовой у AuthGuard
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): any {
    // помечаем как использованные, чтобы не было eslint "unused"
    void info;
    void context;
    void status;

    // формируем строго типизированный результат
    const result: JwtUser | undefined =
      err || !user || user === false ? undefined : (user as JwtUser);

    // возвращаем переменную (не any-выражение) — линтер доволен, TS доволен
    return result;
  }
}
