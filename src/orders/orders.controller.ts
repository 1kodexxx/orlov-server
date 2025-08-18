import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUserId } from '../common/current-user.decorator';

@Controller('checkout')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(200)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  async checkout(@CurrentUserId() userId: number) {
    return this.orders.checkout({ id: userId });
  }
}
