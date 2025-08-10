// src/auth/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ROLES, type Role } from '../types';

function hasRole(u: unknown): u is { role: Role } {
  if (typeof u !== 'object' || u === null) return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o.role === 'string' && (ROLES as readonly string[]).includes(o.role)
  );
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles =
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    if (roles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    if (!hasRole(req.user)) return false;

    return roles.includes(req.user.role);
  }
}
