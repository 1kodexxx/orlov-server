// src/auth/types.ts
export const ROLES = ['admin', 'manager', 'customer'] as const;
export type Role = (typeof ROLES)[number];

export type AuthUser = {
  id: number;
  email: string;
  role: Role;
};

export type PublicUser = AuthUser & {
  tokenVersion: number;
};

/** Пейлоад JWT */
export type JwtPayload = {
  sub: number;
  email: string;
  role: Role;
  ver: number; // версия токенов
  jti?: string; // id access-токена (для blacklist)
  exp?: number; // unix seconds (passport-jwt добавляет)
};

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
