// src/common/blacklist/blacklist.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';

/**
 * Простой in-memory blacklist jti для access-токенов.
 * В проде рекомендуется заменить реализацию на Redis, интерфейс сохранится.
 */
@Injectable()
export class BlacklistService implements OnModuleDestroy {
  private store = new Map<string, number>(); // jti -> expiresAt (unix ms)
  private timer: NodeJS.Timeout;

  constructor() {
    this.timer = setInterval(() => this.gc(), 30_000).unref();
  }

  add(jti: string, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(jti, expiresAt);
  }

  has(jti?: string | null): boolean {
    if (!jti) return false;
    const exp = this.store.get(jti);
    if (!exp) return false;
    if (Date.now() > exp) {
      this.store.delete(jti);
      return false;
    }
    return true;
  }

  private gc(): void {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (v <= now) this.store.delete(k);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }
}
