import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { TelegramService } from './telegram.service';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from './entities/product.entity';
import { Customer } from './entities/customer.entity';

import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Cart,
      CartItem,
      Product,
      Customer,
    ]),
    HttpModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, TelegramService],
})
export class OrdersModule {}
