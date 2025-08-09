import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}), // ключи подаём при signAsync
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    RolesGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
