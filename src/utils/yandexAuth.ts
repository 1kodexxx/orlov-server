// src/utils/yandexAuth.ts
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import jwt from 'jsonwebtoken';

interface AuthorizedKeyJson {
  id: string; // <-- это и есть kid
  service_account_id: string; // <-- это iss
  created_at: string;
  key_algorithm: string; // RSA_2048 / RSA_4096
  public_key: string;
  private_key: string; // PEM
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isAuthorizedKeyJson(x: unknown): x is AuthorizedKeyJson {
  if (!isRecord(x)) return false;
  return (
    typeof x['id'] === 'string' &&
    typeof x['service_account_id'] === 'string' &&
    typeof x['created_at'] === 'string' &&
    typeof x['key_algorithm'] === 'string' &&
    typeof x['public_key'] === 'string' &&
    typeof x['private_key'] === 'string'
  );
}

function readAuthorizedKey(): AuthorizedKeyJson {
  const filePath = process.env.YC_AUTH_KEY_PATH
    ? path.resolve(process.cwd(), process.env.YC_AUTH_KEY_PATH)
    : path.resolve(process.cwd(), 'config', 'authorized_key.json');

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (!isAuthorizedKeyJson(parsed)) {
    throw new Error('authorized_key.json: неверная структура файла');
  }
  return parsed;
}

function buildJwt(saId: string, keyId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
    iss: saId,
    iat: now,
    exp: now + 60 * 60, // максимум 1 час
  };

  // ВАЖНО: укажи keyid (kid). jsonwebtoken сам положит его в header.
  const token = jwt.sign(payload, privateKey, {
    algorithm: 'PS256',
    keyid: keyId,
  });

  return token;
}

/**
 * Получить IAM-токен по JSON-ключу сервисного аккаунта
 */
export async function getIamToken(): Promise<string> {
  const key = readAuthorizedKey();
  const jwtForIam = buildJwt(key.service_account_id, key.id, key.private_key);

  const { data } = await axios.post<{ iamToken: string; expiresAt: string }>(
    'https://iam.api.cloud.yandex.net/iam/v1/tokens',
    { jwt: jwtForIam },
    { timeout: 15000, headers: { 'Content-Type': 'application/json' } },
  );

  if (!data?.iamToken) {
    throw new Error('IAM token empty');
  }
  return data.iamToken;
}
