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
import type { RequestHandler } from 'express';
import * as express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
  });
  const logger = new Logger('Bootstrap');

  const http = app.getHttpAdapter().getInstance();
  http.disable('x-powered-by');

  // 1) Helmet — разрешаем картинки и ресурсы кросс-оригин (полезно в деве)
  const asHelmet: (opts?: HelmetOptions) => RequestHandler =
    helmet as unknown as (opts?: HelmetOptions) => RequestHandler;

  const helmetOptions: HelmetOptions = {
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Разрешаем изображения с нашего сервера + data:/blob:
        'img-src': ["'self'", 'data:', 'blob:', 'http:', 'https:'],
      },
    },
  };
  app.use(asHelmet(helmetOptions));

  // 2) CORS (белый список через CORS_ORIGINS, в деве добавь http://localhost:5173)
  const allowlist = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin(origin, cb) {
      if (!origin || allowlist.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 3) Cookie parser
  const asCookieParser: (
    secret?: string,
    options?: CookieParseOptions,
  ) => RequestHandler = cookieParser as unknown as (
    secret?: string,
    options?: CookieParseOptions,
  ) => RequestHandler;
  app.use(asCookieParser(String(process.env.COOKIE_SECRET ?? '')));

  // 4) Явная раздача /uploads (без дублирования через ServeStaticModule)
  app.use(
    '/uploads',
    express.static(join(process.cwd(), 'uploads'), {
      index: false,
      immutable: true,
      maxAge: '7d',
    }),
  );

  // 5) Глобальные пайпы/интерцепторы
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
  logger.error('❌ Критическая ошибка запуска');
  process.exit(1);
});
