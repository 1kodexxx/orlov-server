// src/database/data-source.ts
import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

// если файл запущен через ts-node — расширение .ts, после сборки — .js
const isTs = __filename.endsWith('.ts');

const options: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres123',
  database: process.env.DATABASE_NAME ?? 'postgres',
  ssl:
    (process.env.DATABASE_SSL ?? 'false') === 'true'
      ? { rejectUnauthorized: false }
      : false,

  // пути к сущностям/миграциям в зависимости от среды
  entities: [isTs ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js'],
  migrations: [
    isTs ? 'src/database/migrations/*.ts' : 'dist/database/migrations/*.js',
  ],
  migrationsTableName: 'migrations',

  // включай/отключай по вкусу
  // logging: true,
};

export default new DataSource(options);
