import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService, CreatedOrder } from './orders.service';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUserId } from '../common/current-user.decorator';

@Controller('checkout')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly tg: TelegramService,
  ) {}

  /** ручная проверка Telegram */
  @Get('ping-tg')
  async pingTg(@Query('m') m?: string) {
    await this.tg.send(m && m.trim() ? m : 'Проверка связи ✅');
    return { ok: true };
  }

  /** создание заказа; защищённый эндпоинт */
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(200)
  async checkout(@CurrentUserId() userId: number): Promise<CreatedOrder> {
    return this.orders.checkout({ id: userId });
  }
}
