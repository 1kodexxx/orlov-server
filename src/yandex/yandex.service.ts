import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosResponse } from 'axios';

/* ===== Типы ===== */
type Role = 'system' | 'user' | 'assistant';
interface YCMessage {
  role: Role;
  text: string;
}
interface YCAlternative {
  message: YCMessage;
}
interface YCResult {
  alternatives?: YCAlternative[];
}
interface YCCompletionResponse {
  result?: YCResult;
}

/* ===== Хелперы ===== */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function isYCCompletionResponse(x: unknown): x is YCCompletionResponse {
  if (!isRecord(x)) return false;
  const r = x['result'];
  if (r === undefined) return true;
  if (!isRecord(r)) return false;
  const alts = r['alternatives'];
  return alts === undefined || Array.isArray(alts);
}
function isAxiosErr(e: unknown): e is AxiosError {
  return typeof e === 'object' && e !== null && 'isAxiosError' in (e as any);
}

/* ===== Константы ===== */
const LLM_BASE_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1';
const SYSTEM_PROMPT = [
  'Ты — вежливый ассистент интернет-магазина "Orlov".',
  'Помогаешь выбрать чехол, уточняешь модель телефона, материалы и коллекции,',
  'рассказываешь про доставку/оплату/возврат. Если вопрос не про магазин —',
  'мягко возвращай разговор к ассортименту.',
].join(' ');

@Injectable()
export class YandexService {
  private readonly folderId: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(cfg: ConfigService) {
    this.folderId = cfg.get<string>('YANDEXGPT_FOLDER_ID', '');
    this.apiKey = cfg.get<string>('YANDEXGPT_API_KEY', '');
    this.model = cfg.get<string>('YANDEXGPT_MODEL', 'yandexgpt-lite');
    this.timeoutMs = parseInt(
      cfg.get<string>('YANDEXGPT_TIMEOUT_MS', '15000'),
      10,
    );

    if (!this.folderId) throw new Error('YANDEXGPT_FOLDER_ID не задан в .env');
    if (!this.apiKey) throw new Error('YANDEXGPT_API_KEY не задан в .env');
  }

  /** Один запрос к YandexGPT */
  async complete(userMessage: string): Promise<string> {
    // основной вариант URI
    const modelUri = `gpt://${this.folderId}/${this.model}/latest`;

    const payload = {
      modelUri,
      completionOptions: { stream: false, temperature: 0.6, maxTokens: 700 },
      messages: [
        { role: 'system', text: SYSTEM_PROMPT },
        { role: 'user', text: userMessage },
      ] as YCMessage[],
    };

    try {
      const res: AxiosResponse<YCCompletionResponse> = await axios.post(
        `${LLM_BASE_URL}/completion`,
        payload,
        {
          timeout: this.timeoutMs,
          headers: {
            Authorization: `Api-Key ${this.apiKey}`,
            'Content-Type': 'application/json',
            'x-folder-id': this.folderId, // иногда требуется явно
          },
        },
      );

      const data = res.data;
      if (!isYCCompletionResponse(data)) {
        throw new InternalServerErrorException(
          'Неверный формат ответа от YandexGPT',
        );
      }

      const text = data.result?.alternatives?.[0]?.message?.text;
      if (!text)
        throw new InternalServerErrorException('Пустой ответ от YandexGPT');

      return text;
    } catch (e) {
      if (isAxiosErr(e)) {
        // временный подробный лог для диагностики

        console.error(
          'YC error:',
          e.response?.status,
          JSON.stringify(e.response?.data),
        );

        const status = e.response?.status;
        const body = e.response?.data;
        let msg = 'YandexGPT request failed';
        if (isRecord(body) && typeof body.message === 'string')
          msg = body.message;

        if (status && status >= 400 && status < 500)
          throw new BadRequestException(msg);
        throw new InternalServerErrorException(msg);
      }
      throw new InternalServerErrorException('YandexGPT request failed');
    }
  }
}
