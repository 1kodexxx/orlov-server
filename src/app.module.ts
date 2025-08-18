import { Module, Logger, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { YandexModule } from './yandex/yandex.module';
import { ViewsModule } from './views/views.module';
import { CatalogModule } from './catalog/catalog.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CompanyReviewsModule } from './company-reviews/company-reviews.module';
import { VisitorIdMiddleware } from './common/visitor/visitor-id.middleware';

import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    // .env доступен всем ниже
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
    }),

    ViewsModule,
    UsersModule,
    CatalogModule,
    FavoritesModule,
    AuthModule,
    CompanyReviewsModule,
    YandexModule,

    OrdersModule,

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST'),
        port: Number(config.get('DATABASE_PORT') ?? 5432),
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME'),
        ssl:
          String(config.get('DATABASE_SSL') ?? 'false').toLowerCase() ===
          'true',
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
    consumer.apply(VisitorIdMiddleware).forRoutes('catalog', 'favorites');
  }
}
