import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);
  private readonly token = process.env.TG_BOT_TOKEN;
  private readonly chatId = process.env.TG_CHAT_ID;
  private readonly threadId = process.env.TG_THREAD_ID; // опционально

  constructor(private readonly http: HttpService) {}

  async send(html: string) {
    if (!this.token || !this.chatId) {
      this.log.warn(
        'TG_BOT_TOKEN или TG_CHAT_ID не заданы — уведомление пропущено',
      );
      return;
    }
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      await firstValueFrom(
        this.http.post(url, {
          chat_id: this.chatId,
          message_thread_id: this.threadId ? Number(this.threadId) : undefined,
          text: html,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      );
    } catch (e) {
      this.log.error('Не удалось отправить сообщение в Telegram', e as any);
    }
  }

  /** Фото + подпись (HTML). Удобно для «резюме» с аватаром */
  async sendPhoto(photoUrl: string, captionHtml: string) {
    if (!this.token || !this.chatId) {
      this.log.warn(
        'TG_BOT_TOKEN или TG_CHAT_ID не заданы — уведомление с фото пропущено',
      );
      return;
    }
    const url = `https://api.telegram.org/bot${this.token}/sendPhoto`;
    try {
      await firstValueFrom(
        this.http.post(url, {
          chat_id: this.chatId,
          message_thread_id: this.threadId ? Number(this.threadId) : undefined,
          photo: photoUrl,
          caption: captionHtml,
          parse_mode: 'HTML',
        }),
      );
    } catch (e) {
      this.log.error('Не удалось отправить фото в Telegram', e as any);
      // в случае ошибки всё равно попробуем отправить просто текст
      await this.send(captionHtml);
    }
  }
}
