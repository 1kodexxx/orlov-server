// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ValidationPipe,
  Logger,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import helmet, { type HelmetOptions } from 'helmet';
import cookieParser, { type CookieParseOptions } from 'cookie-parser';
import type { Express, RequestHandler } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const logger = new Logger('Bootstrap');

  // Убираем заголовок Express корректно
  (app.getHttpAdapter().getInstance() as Express).disable('x-powered-by');

  // 1) Helmet (явные типы, чтобы не было "unsafe call")
  const asHelmet: (opts?: HelmetOptions) => RequestHandler =
    helmet as unknown as (opts?: HelmetOptions) => RequestHandler;

  const helmetOptions: HelmetOptions = {
    crossOriginResourcePolicy: { policy: 'same-site' },
  };
  app.use(asHelmet(helmetOptions));

  // 2) Строгий CORS (типизируем колбэк)
  const allowlist = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin(
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || allowlist.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 3) Cookie (также типизирован вызов)
  const asCookieParser: (
    secret?: string,
    options?: CookieParseOptions,
  ) => RequestHandler = cookieParser as unknown as (
    secret?: string,
    options?: CookieParseOptions,
  ) => RequestHandler;

  const cookieSecret = String(process.env.COOKIE_SECRET ?? '');
  app.use(asCookieParser(cookieSecret));

  // 4) Глобальные пайпы/интерцепторы
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`🚀 Сервер запущен на http://localhost:${port}`);
}

bootstrap().catch(() => {
  const logger = new Logger('Bootstrap');
  // не палим детали в stdout; при необходимости можно отправить в APM/логгер
  logger.error('❌ Критическая ошибка запуска');
  process.exit(1);
});
