// src/yandex/iam.manager.ts
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import fs from 'fs/promises';
import jwt, { type Algorithm } from 'jsonwebtoken';

export interface AuthorizedKey {
  id?: string;
  key_id?: string;
  service_account_id: string;
  private_key: string; // PEM
}

interface YcIamTokenResp {
  iamToken: string;
  expiresAt: string; // RFC3339
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0;
}

function isAuthorizedKey(val: unknown): val is AuthorizedKey {
  if (typeof val !== 'object' || val === null) return false;

  const o = val as Record<string, unknown>;
  const hasId = isNonEmptyString(o.service_account_id);
  const hasKey = isNonEmptyString(o.private_key);

  return hasId && hasKey;
}

export class YcIamManager {
  private key?: AuthorizedKey;
  private token?: { value: string; expiresAtSec: number };

  constructor(
    private readonly http: HttpService,
    private readonly keyPath: string,
  ) {}

  private async loadKey(): Promise<AuthorizedKey> {
    if (this.key) return this.key;

    const raw = await fs.readFile(this.keyPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isAuthorizedKey(parsed)) {
      throw new Error('YC authorized key JSON has unexpected shape');
    }
    this.key = parsed;
    return this.key;
  }

  private async fetchToken(): Promise<{ iamToken: string; expiresAt: string }> {
    const key = await this.loadKey();
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
      iss: key.service_account_id,
      sub: key.service_account_id,
      iat: now,
      exp: now + 3600, // 1 hour
    } as const;

    const assertion = jwt.sign(payload, key.private_key, {
      algorithm: 'PS256' as Algorithm,
      keyid: key.id ?? key.key_id,
    });

    const resp = await lastValueFrom(
      this.http.post<YcIamTokenResp>(
        'https://iam.api.cloud.yandex.net/iam/v1/tokens',
        { jwt: assertion },
      ),
    );

    const data: YcIamTokenResp = resp.data;
    return { iamToken: data.iamToken, expiresAt: data.expiresAt };
  }

  /** Вернёт валидный токен; обновит, если осталось < 5 минут */
  async getToken(): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000);
    if (!this.token || this.token.expiresAtSec - nowSec < 300) {
      const { iamToken, expiresAt } = await this.fetchToken();
      const expSec =
        Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > 0
          ? Math.floor(new Date(expiresAt).getTime() / 1000)
          : nowSec + 3600;
      this.token = { value: iamToken, expiresAtSec: expSec };
    }
    return this.token.value;
  }
}
