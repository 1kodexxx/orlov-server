// src/views/views.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewsService } from './views.service';
import { ProductView } from '../shop/entities/product-view.entity';
import { Product } from '../shop/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductView, Product])],
  providers: [ViewsService],
  exports: [ViewsService], // важно для интерцептора в ShopController
})
export class ViewsModule {}
