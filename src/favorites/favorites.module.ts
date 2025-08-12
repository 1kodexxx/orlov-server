import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { LikesModule } from '../catalog/likes/likes.module';

@Module({
  imports: [LikesModule], // переиспользуем LikesService
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
