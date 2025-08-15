import { Body, Controller, Post } from '@nestjs/common';
import { YandexService } from './yandex.service';
import { ChatDto } from './dto/chat.dto';

@Controller('yandex')
export class YandexController {
  constructor(private readonly yandex: YandexService) {}

  @Post('chat')
  async chat(@Body() dto: ChatDto) {
    const reply = await this.yandex.complete(dto.message);
    return { reply };
  }
}
