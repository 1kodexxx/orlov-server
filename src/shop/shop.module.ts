// src/shop/shop.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { PhoneModel } from './entities/phone-model.entity';
import { ViewsModule } from '../views/views.module'; // <-- ВАЖНО

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category, PhoneModel]),
    ViewsModule,
  ],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
