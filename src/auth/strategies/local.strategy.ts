import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { JwtPayload } from './jwt-access.strategy';
import { isAuthUser } from '../types';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email' });
  }

  // Явно типизируем, что возвращаем JWT payload
  async validate(email: string, password: string): Promise<JwtPayload> {
    const user = await this.auth.validateUser(email, password);

    // Узкая проверка вместо any — и линтер доволен
    if (!isAuthUser(user)) {
      throw new UnauthorizedException();
    }

    // Легковесный payload для последующей подписи access/refresh токенов
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
