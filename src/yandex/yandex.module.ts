import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { YandexService } from './yandex.service';
import { YandexController } from './yandex.controller';

@Module({
  imports: [HttpModule],
  controllers: [YandexController],
  providers: [YandexService],
  exports: [YandexService],
})
export class YandexModule {}
