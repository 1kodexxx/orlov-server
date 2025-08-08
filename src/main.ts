import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  logger.log(`✅ DB connected (см. логи AppModule)`);
  logger.log(`🚀 Server started: http://localhost:${port}`);
}

bootstrap().catch((err) => {
  // чтобы промис не оставался без обработчика
  console.error('❌ Fatal error during bootstrap:', err);
  process.exit(1);
});
