import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Опциональный guard: не бросает 401 — вернёт user | undefined */
@Injectable()
export class JwtOptionalAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user ?? undefined;
  }
}
