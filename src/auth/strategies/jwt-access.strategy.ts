// src/auth/strategies/jwt-access.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types';
import { UsersService } from '../../users/users.service';
import { BlacklistService } from '../../common/blacklist/blacklist.service';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly users: UsersService,
    private readonly blacklist: BlacklistService,
  ) {
    const publicKey = (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: publicKey,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // мгновенная инвалидизация access по jti (logout)
    if (this.blacklist.has(payload.jti)) {
      throw new UnauthorizedException();
    }

    // сверка версии токенов
    const user = await this.users.findById(payload.sub);
    if (!user || (user.tokenVersion ?? 0) !== payload.ver) {
      throw new UnauthorizedException();
    }

    return payload;
  }
}
