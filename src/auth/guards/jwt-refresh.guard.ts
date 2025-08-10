// src/auth/guards/jwt-refresh.guard.ts
import { AuthGuard } from '@nestjs/passport';
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
