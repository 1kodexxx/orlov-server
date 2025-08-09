import { AuthGuard } from '@nestjs/passport';
export class LocalAuthGuard extends AuthGuard('local') {}
export class JwtAuthGuard extends AuthGuard('jwt') {}
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
