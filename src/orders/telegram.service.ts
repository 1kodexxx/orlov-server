import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);
  private readonly token = process.env.TG_BOT_TOKEN ?? '';
  private readonly chatId = process.env.TG_CHAT_ID ?? '';
  private readonly threadId = process.env.TG_THREAD_ID ?? '';

  constructor(private readonly http: HttpService) {}

  /** простой текст */
  async send(text: string): Promise<void> {
    if (!this.token || !this.chatId) {
      this.log.warn('TG_BOT_TOKEN/TG_CHAT_ID не заданы — пропускаю отправку');
      return;
    }
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      await firstValueFrom(
        this.http.post(url, {
          chat_id: this.chatId,
          message_thread_id: this.threadId || undefined,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Не удалось отправить message: ${msg}`);
    }
  }

  /** фото по URL + подпись */
  async sendPhoto(photoUrl: string, caption: string): Promise<void> {
    if (!this.token || !this.chatId) {
      this.log.warn('TG_BOT_TOKEN/TG_CHAT_ID не заданы — пропускаю отправку');
      return;
    }
    const url = `https://api.telegram.org/bot${this.token}/sendPhoto`;
    try {
      await firstValueFrom(
        this.http.post(url, {
          chat_id: this.chatId,
          message_thread_id: this.threadId || undefined,
          photo: photoUrl,
          caption,
          parse_mode: 'HTML',
          disable_notification: false,
        }),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Не удалось отправить photo: ${msg}`);
    }
  }
}
