import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('api/health')
export class HealthController {
  constructor(private readonly ds: DataSource) {}

  @Get()
  async check() {
    // ping DB
    let db = 'down';
    try {
      await this.ds.query('SELECT 1');
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      db,
      env: process.env.NODE_ENV ?? 'development',
      time: new Date().toISOString(),
    };
  }
}
