import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    HealthModule,
    UsersModule,
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
        logging: true, // лог SQL-запросов
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
