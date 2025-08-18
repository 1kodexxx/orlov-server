import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);
  private readonly token = process.env.TG_BOT_TOKEN;
  private readonly chatId = process.env.TG_CHAT_ID;

  constructor(private readonly http: HttpService) {}

  async send(html: string) {
    if (!this.token || !this.chatId) {
      this.log.warn(
        'TG_BOT_TOKEN or TG_CHAT_ID not set, skipping telegram notification',
      );
      return;
    }
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      await firstValueFrom(
        this.http.post(url, {
          chat_id: this.chatId,
          text: html,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      );
    } catch (e) {
      this.log.error('Failed to send Telegram message', e as any);
    }
  }
}
