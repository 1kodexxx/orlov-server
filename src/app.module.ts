// src/app.module.ts
import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ViewsModule } from './views/views.module';
import { ShopModule } from './shop/shop.module';

@Module({
  imports: [
    // ⬇️ раздаём папку uploads по пути /static
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/static',
      serveStaticOptions: {
        index: false,
        // fallthrough:false — чтобы не было «Cannot GET ...», а сразу 404 отдавалось express-static
        fallthrough: false,
      },
    }),
    ViewsModule,
    UsersModule,
    ShopModule,
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        logging: true,
      }),
    }),
  ],
})
export class AppModule {
  private readonly logger = new Logger(AppModule.name);
  constructor(private dataSource: DataSource) {
    if (this.dataSource.isInitialized) {
      this.logger.log('✅ Подключение к базе данных установлено успешно');
    } else {
      this.logger.error('❌ Не удалось подключиться к базе данных');
    }
  }
}
