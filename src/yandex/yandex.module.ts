import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { YandexController } from './yandex.controller';
import { YandexService } from './yandex.service';

@Module({
  imports: [
    ConfigModule, // доступ к .env
    HttpModule, // не обязателен, но можно оставить
  ],
  controllers: [YandexController],
  providers: [YandexService],
  exports: [YandexService],
})
export class YandexModule {}
