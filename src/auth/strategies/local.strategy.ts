// src/auth/strategies/local.strategy.ts
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { JwtPayload, isPublicUser } from '../types';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<JwtPayload> {
    const user = await this.auth.validateUser(email, password);
    if (!isPublicUser(user)) throw new UnauthorizedException();

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      ver: user.tokenVersion,
    };
  }
}
