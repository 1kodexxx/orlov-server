import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { YandexService } from './yandex.service';
import { ChatDto } from './dto/chat.dto';

type ChatResponse = {
  modelUri: string;
  role: 'assistant';
  text: string;
  usage: {
    inputTextTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
};

@Controller('yandex')
export class YandexController {
  constructor(private readonly yandex: YandexService) {}

  @Get('health')
  health() {
    return { ok: true, modelUri: process.env.YANDEX_MODEL_URI };
  }

  /** Нестримающий ответ (одним JSON) */
  @Post('chat')
  @HttpCode(200)
  async chat(@Body() dto: ChatDto): Promise<ChatResponse> {
    return this.yandex.complete(dto);
  }

  /** Стриминговый ответ (SSE) */
  @Post('chat/stream')
  async chatStream(@Body() dto: ChatDto, @Res() res: Response) {
    await this.yandex.streamComplete(dto, res);
  }
}
