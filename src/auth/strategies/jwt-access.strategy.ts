// src/auth/strategies/jwt-access.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { JwtPayload } from '../types';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly users: UsersService) {
    const opts: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n'),
    };
    super(opts);
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    if ((user.tokenVersion ?? 0) !== payload.ver) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
