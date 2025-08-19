import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrdersService, CreatedOrder } from './orders.service';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../auth/guards';
import { ClientOrderNotifyDto } from './dto/client-notify.dto';

type JwtPayload = {
  sub: number;
  email: string;
  role: 'admin' | 'manager' | 'customer';
};

@Controller('checkout')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly tg: TelegramService,
  ) {}

  @Get('ping-tg')
  async pingTg(@Query('m') m?: string) {
    await this.tg.send(m && m.trim() ? m : 'Проверка связи ✅');
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(200)
  async checkout(@Req() req: Request): Promise<CreatedOrder> {
    const userId = (req.user as JwtPayload).sub;
    return this.orders.checkout({ id: userId });
  }

  @UseGuards(JwtAuthGuard)
  @Post('front')
  @HttpCode(200)
  async checkoutFront(@Req() req: Request, @Body() dto: ClientOrderNotifyDto) {
    const userId = (req.user as JwtPayload).sub;
    return this.orders.notifyFromClient(userId, dto);
  }

  // 🔹 История заказов текущего пользователя
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async my(@Req() req: Request) {
    const userId = (req.user as JwtPayload).sub;
    return this.orders.getMyOrders(userId);
  }
}
