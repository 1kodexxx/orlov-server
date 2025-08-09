// src/auth/types.ts

/** Роли пользователя */
export const ROLES = ['admin', 'manager', 'customer'] as const;
export type Role = (typeof ROLES)[number];

/** Публичный пользователь (минимальный набор) */
export type AuthUser = {
  id: number;
  email: string;
  role: Role;
};

/** Пользователь с версией токенов (для выпуска JWT) */
export type PublicUser = AuthUser & {
  tokenVersion: number;
};

/** Пейлоад, который кладём в JWT */
export type JwtPayload = {
  sub: number;
  email: string;
  role: Role;
  /** Версия токенов пользователя для немедленной инвалидизации */
  ver: number;
};

/** Узкие type-guards */
export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

export function isAuthUser(u: unknown): u is AuthUser {
  if (typeof u !== 'object' || u === null) return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o.id === 'number' && typeof o.email === 'string' && isRole(o.role)
  );
}

export function isPublicUser(u: unknown): u is PublicUser {
  if (!isAuthUser(u)) return false;
  const o = u as Record<string, unknown>;
  return typeof o.tokenVersion === 'number';
}

export function isJwtPayload(u: unknown): u is JwtPayload {
  if (typeof u !== 'object' || u === null) return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o.sub === 'number' &&
    typeof o.email === 'string' &&
    isRole(o.role) &&
    typeof o.ver === 'number'
  );
}
