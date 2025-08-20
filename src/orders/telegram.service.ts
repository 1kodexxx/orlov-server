import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);
  private readonly token = process.env.TG_BOT_TOKEN ?? '';

  // Новое: поддержка нескольких целей
  // Пример: TG_TARGETS="-1002964024551,6167850750"
  private readonly targets: string[] = (process.env.TG_TARGETS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Фолбэк на старые переменные (оставляем совместимость)
  private readonly chatId = process.env.TG_CHAT_ID ?? '';
  private readonly adminId = process.env.TG_ADMIN_ID ?? '';

  // Необязательный id топика в супергруппе
  private readonly threadId = process.env.TG_THREAD_ID ?? '';

  constructor(private readonly http: HttpService) {}

  private getAllTargets(): string[] {
    if (this.targets.length > 0) return this.targets;
    const arr = [this.chatId, this.adminId].filter(Boolean);
    return arr.length ? arr : [];
  }

  async send(text: string): Promise<void> {
    const chats = this.getAllTargets();
    if (!this.token || chats.length === 0) {
      this.log.warn(
        'Нет токена или получателей (TG_BOT_TOKEN/TG_TARGETS/TG_CHAT_ID) — пропускаю отправку',
      );
      return;
    }
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;

    for (const chat_id of chats) {
      try {
        await firstValueFrom(
          this.http.post(url, {
            chat_id,
            message_thread_id: this.threadId || undefined,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.error(`Не удалось отправить message в ${chat_id}: ${msg}`);
      }
    }
  }

  async sendPhoto(photoUrl: string, caption: string): Promise<void> {
    const chats = this.getAllTargets();
    if (!this.token || chats.length === 0) {
      this.log.warn(
        'Нет токена или получателей (TG_BOT_TOKEN/TG_TARGETS/TG_CHAT_ID) — пропускаю отправку',
      );
      return;
    }
    const url = `https://api.telegram.org/bot${this.token}/sendPhoto`;

    for (const chat_id of chats) {
      try {
        await firstValueFrom(
          this.http.post(url, {
            chat_id,
            message_thread_id: this.threadId || undefined,
            photo: photoUrl,
            caption,
            parse_mode: 'HTML',
            disable_notification: false,
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.error(`Не удалось отправить photo в ${chat_id}: ${msg}`);
      }
    }
  }
}
