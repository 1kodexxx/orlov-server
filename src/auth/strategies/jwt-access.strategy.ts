import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';

export interface JwtPayload {
  sub: number;
  email: string;
  role: 'admin' | 'manager' | 'customer';
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const opts: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n'),
    };
    super(opts);
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
