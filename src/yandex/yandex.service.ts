import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { isAxiosError, type AxiosError } from 'axios';
import type { Response } from 'express';
import { ChatDto } from './dto/chat.dto';
import { YcIamManager } from './iam.manager';

/* =========================
 * Типы YC Completion API
 * ========================= */

type Role = 'system' | 'user' | 'assistant';

interface YCMessage {
  role: Role;
  text: string;
}
interface YCCompletionOptions {
  stream: boolean;
  temperature: number;
  maxTokens: number;
}
interface YCRequestBody {
  modelUri: string;
  completionOptions: YCCompletionOptions;
  messages: YCMessage[];
}

interface YCUsage {
  inputTextTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface YCAlternative {
  message?: { role?: Role; text?: string };
}
interface YCResult {
  alternatives?: YCAlternative[];
  usage?: YCUsage;
}
interface YCResponse {
  result?: YCResult;
}
interface YCStreamChunk {
  result?: YCResult;
}

/* =========================
 * Утилиты окружения
 * ========================= */

function envStr(name: string, fallback = ''): string {
  const v = process.env[name];
  return (v ?? fallback).toString().trim();
}

function envNum(name: string, fallback: number): number {
  const v = process.env[name];
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* =========================
 * Type guards / helpers
 * ========================= */

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}
function hasOwn(obj: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

@Injectable()
export class YandexService {
  private readonly logger = new Logger(YandexService.name);
  private readonly endpoint =
    'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

  // допускаем три варианта авторизации
  private readonly apiKey = envStr('YANDEXGPT_API_KEY');
  private readonly envIam = envStr('YC_IAM_TOKEN');
  private readonly authKeyPath = envStr('YC_AUTHORIZED_KEY_PATH');

  private readonly folderId = envStr('YANDEXGPT_FOLDER_ID');
  private readonly modelUri =
    envStr('YANDEX_MODEL_URI') || `gpt://${this.folderId}/yandexgpt-lite`;
  private readonly defaultTemp = envNum('YANDEX_TEMPERATURE', 0.2);
  private readonly defaultMaxTokens = envNum('YANDEX_MAX_TOKENS', 800);

  private iamManager?: YcIamManager;

  constructor(private readonly http: HttpService) {
    if (!this.folderId) {
      throw new Error('YANDEXGPT_FOLDER_ID не задан в окружении');
    }
    if (!this.apiKey && !this.envIam && !this.authKeyPath) {
      throw new Error(
        'Нужен либо YANDEXGPT_API_KEY, либо YC_IAM_TOKEN, либо YC_AUTHORIZED_KEY_PATH',
      );
    }
    if (this.authKeyPath) {
      this.iamManager = new YcIamManager(this.http, this.authKeyPath);
    }
  }

  // теперь заголовки асинхронные (если надо получить/обновить IAM-токен)
  private async headers(): Promise<Record<string, string>> {
    if (this.envIam) {
      return {
        Authorization: `Bearer ${this.envIam}`,
        'x-folder-id': this.folderId,
        'Content-Type': 'application/json',
      };
    }
    if (this.iamManager) {
      const iam = await this.iamManager.getToken();
      return {
        Authorization: `Bearer ${iam}`,
        'x-folder-id': this.folderId,
        'Content-Type': 'application/json',
      };
    }
    // fallback: Api-Key
    return {
      Authorization: `Api-Key ${this.apiKey}`,
      'x-folder-id': this.folderId,
      'Content-Type': 'application/json',
    };
  }

  private withSystem(dto: ChatDto): YCMessage[] {
    const sys =
      dto.systemPrompt ??
      [
        'Ты — виртуальный консультант интернет-магазина ORLOV, специализируешься на элитных чехлах для телефонов.',
        'Общайся дружелюбно, вежливо и уважительно, будь хорошим собеседником.',
        'Отвечай кратко и по делу, но если клиенту нужно — поддерживай лёгкий диалог.',
        'Главная задача — помочь подобрать чехол по модели телефона, материалу, коллекции и бюджету.',
        'Акцентируй внимание на премиальности и качестве продукции.',
        'Если не уверен в цене или наличии — честно скажи, что нужно уточнить.',
        'Также можешь подсказать по уходу за чехлом, условиям доставки или возврата.',
        'Никогда не придумывай информацию, если её нет.',
        'Всегда отвечай на русском языке.',
      ].join('\n');

    const msgs = dto.messages.filter((m) => m.role !== 'system');
    return [{ role: 'system', text: sys }, ...msgs] as YCMessage[];
  }

  /* =========================
   * Нестримающий ответ
   * ========================= */
  async complete(dto: ChatDto): Promise<{
    modelUri: string;
    role: 'assistant';
    text: string;
    usage: YCUsage | null;
  }> {
    const body: YCRequestBody = {
      modelUri: this.modelUri,
      completionOptions: {
        stream: false,
        temperature: dto.temperature ?? this.defaultTemp,
        maxTokens: dto.maxTokens ?? this.defaultMaxTokens,
      },
      messages: this.withSystem(dto),
    };

    try {
      const resp = await lastValueFrom(
        this.http.post<YCResponse>(this.endpoint, body, {
          headers: await this.headers(),
        }),
      );
      const data = resp.data;

      const alt = data?.result?.alternatives?.[0];
      const text = alt?.message?.text ?? '';
      const usage = data?.result?.usage ?? null;

      return { modelUri: this.modelUri, role: 'assistant', text, usage };
    } catch (err: unknown) {
      this.logger.error(this.stringifyAxiosError(err));
      if (isAxiosError(err) && err.response?.status === 403) {
        throw new Error(
          '403 Forbidden от Yandex API: проверь ключ/токен, права на папку (folderId) и что modelUri указывает на тот же folderId.',
        );
      }
      throw err;
    }
  }

  /* =========================
   * Стриминг (SSE)
   * ========================= */
  async streamComplete(dto: ChatDto, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const body: YCRequestBody = {
      modelUri: this.modelUri,
      completionOptions: {
        stream: true,
        temperature: dto.temperature ?? this.defaultTemp,
        maxTokens: dto.maxTokens ?? this.defaultMaxTokens,
      },
      messages: this.withSystem(dto),
    };

    try {
      const axiosResp = await lastValueFrom(
        this.http.post(this.endpoint, body, {
          headers: await this.headers(),
          responseType: 'stream' as const,
        }),
      );

      const readable = axiosResp.data as NodeJS.ReadableStream;

      let buffer = '';
      readable.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');

        let nl = buffer.indexOf('\n');
        while (nl !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          nl = buffer.indexOf('\n');

          if (!line) continue;

          try {
            const obj: unknown = JSON.parse(line);
            if (this.isYCStreamChunk(obj)) {
              const part = obj.result?.alternatives?.[0]?.message?.text;
              if (typeof part === 'string' && part.length > 0) {
                res.write(`data: ${JSON.stringify(part)}\n\n`);
              }
            }
          } catch {
            // обрыв JSON — ждём следующий чанк
          }
        }
      });

      readable.on('end', () => {
        res.write('event: end\ndata: [DONE]\n\n');
        res.end();
      });

      readable.on('error', (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(msg);
        res.write(`event: error\ndata: ${JSON.stringify(msg)}\n\n`);
        res.end();
      });
    } catch (err: unknown) {
      this.logger.error(this.stringifyAxiosError(err));
      res.status(500).json({
        error: 'Yandex streaming request failed',
        details: this.stringifyAxiosError(err),
      });
    }
  }

  /* =========================
   * Вспомогательные
   * ========================= */
  private stringifyAxiosError(err: unknown): string {
    if (isAxiosError(err)) {
      const ax = err as AxiosError<unknown, unknown>;
      const status = ax.response?.status;
      const data: unknown = ax.response?.data;
      return `AxiosError(${status}): ${ax.message} ${data ? JSON.stringify(data) : ''}`.trim();
    }
    return err instanceof Error ? err.message : String(err);
  }

  private isYCStreamChunk(val: unknown): val is YCStreamChunk {
    return isRecord(val) && hasOwn(val, 'result');
  }
}
