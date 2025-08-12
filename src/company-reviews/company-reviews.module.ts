// src/company-reviews/company-reviews.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyReview } from './company-reviews.entity';
import { CompanyReviewsService } from './company-reviews.service';
import { CompanyReviewsController } from './company-reviews.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyReview])],
  providers: [CompanyReviewsService],
  controllers: [CompanyReviewsController],
  exports: [CompanyReviewsService],
})
export class CompanyReviewsModule {}
