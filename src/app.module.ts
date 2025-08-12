import { Module, Logger, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ViewsModule } from './views/views.module';
import { CatalogModule } from './catalog/catalog.module'; // модуль можно не переименовывать
import { VisitorIdMiddleware } from './common/visitor/visitor-id.middleware';

@Module({
  imports: [
    // раздаём uploads по /static
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/static',
      serveStaticOptions: { index: false, fallthrough: false },
    }),
    ViewsModule,
    UsersModule,
    CatalogModule,
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        logging: true,
      }),
    }),
  ],
})
export class AppModule implements NestModule {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly dataSource: DataSource) {
    if (this.dataSource.isInitialized) {
      this.logger.log('✅ Подключение к базе данных установлено успешно');
    } else {
      this.logger.error('❌ Не удалось подключиться к базе данных');
    }
  }

  configure(consumer: MiddlewareConsumer) {
    // выдаём/читаем visitorId на всех маршрутах каталога
    consumer.apply(VisitorIdMiddleware).forRoutes('catalog');
  }
}
