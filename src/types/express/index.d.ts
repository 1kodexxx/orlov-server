import { JwtPayload } from '../../auth/types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload; // { sub: number; email: string; role: string; }
  }
}
