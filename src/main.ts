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

  // полезно для корректной работы X-Forwarded-* на Railway/Render
  app.set('trust proxy', 1);

  const http = app.getHttpAdapter().getInstance();
  http.disable('x-powered-by');

  // 1) Helmet
  const asHelmet: (opts?: HelmetOptions) => RequestHandler =
    helmet as unknown as (opts?: HelmetOptions) => RequestHandler;

  const helmetOptions: HelmetOptions = {
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'http:', 'https:'],
      },
    },
  };
  app.use(asHelmet(helmetOptions));

  // 2) CORS через белый список
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

  // 4) Статика /uploads
  app.use(
    '/uploads',
    express.static(join(process.cwd(), 'uploads'), {
      index: false,
      immutable: true,
      maxAge: '7d',
    }),
  );

  // 5) Общие пайпы/интерцепторы
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // (опционально) общий префикс, чтобы фронту было проще
  // app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`🚀 Сервер запущен на http://localhost:${port}`);
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Критическая ошибка запуска', err);
  process.exit(1);
});
