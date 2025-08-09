import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { Request } from 'express';

type RoleName = 'admin' | 'manager' | 'customer';

// Узкая проверка: есть поле role и оно из разрешённого множества
function hasRole(u: unknown): u is { role: RoleName } {
  if (typeof u !== 'object' || u === null) return false;
  const o = u as Record<string, unknown>;
  if (typeof o.role !== 'string') return false;
  const roles = ['admin', 'manager', 'customer'] as const;
  return roles.includes(o.role as (typeof roles)[number]);
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles =
      this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    // если роли на маршруте не заданы — пропускаем
    if (roles.length === 0) return true;

    // Явно типизируем Request, чтобы не было any
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = req.user;

    if (!hasRole(user)) return false;
    return roles.includes(user.role);
  }
}
