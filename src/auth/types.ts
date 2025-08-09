// src/auth/types.ts

/** Роли пользователя */
export const ROLES = ['admin', 'manager', 'customer'] as const;
export type Role = (typeof ROLES)[number];

/** Публичный пользователь (внутри приложения) */
export type AuthUser = {
  id: number;
  email: string;
  role: Role;
};

/** Пейлоад, который мы кладём в JWT */
export type JwtPayload = {
  sub: number;
  email: string;
  role: Role;
};

/** Узкий type-guard для Role */
export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

/** Узкий type-guard для AuthUser */
export function isAuthUser(u: unknown): u is AuthUser {
  if (typeof u !== 'object' || u === null) return false;

  const o = u as Record<string, unknown>;
  return (
    typeof o.id === 'number' && typeof o.email === 'string' && isRole(o.role)
  );
}

/** Узкий type-guard для JwtPayload */
export function isJwtPayload(u: unknown): u is JwtPayload {
  if (typeof u !== 'object' || u === null) return false;

  const o = u as Record<string, unknown>;
  return (
    typeof o.sub === 'number' && typeof o.email === 'string' && isRole(o.role)
  );
}
