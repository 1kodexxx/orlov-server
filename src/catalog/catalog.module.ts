import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

import { Category } from './entities/category.entity';
import { PhoneModel } from './entities/phone-model.entity';
import { LikesModule } from './likes/likes.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category, PhoneModel]), LikesModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
