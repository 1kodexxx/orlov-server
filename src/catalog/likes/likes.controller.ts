import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { LikesService } from './likes.service';
import { JwtOptionalAuthGuard } from '../../auth/guards';
import { isJwtPayload, type JwtPayload } from '../../auth/types';
import type { ProductRow } from '../catalog.service';

type ReqMaybeUser = Request & { user?: unknown; visitorId?: string };

@Controller('catalog')
@UseGuards(JwtOptionalAuthGuard) // если есть Bearer — будет user, иначе — гость
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  /** Поставить лайк: доступно всем (user || visitorId) */
  @Post(':id/like')
  async like(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ReqMaybeUser,
  ): Promise<{ liked: true }> {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    const owner = payload
      ? { customerId: payload.sub }
      : { visitorId: req.visitorId! };
    return this.likes.likeOnce(id, owner);
  }

  /** Снять лайк: доступно всем (user || visitorId) */
  @Delete(':id/like')
  async unlike(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ReqMaybeUser,
  ): Promise<{ liked: false }> {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    const owner = payload
      ? { customerId: payload.sub }
      : { visitorId: req.visitorId! };
    return this.likes.unlike(id, owner);
  }

  /** Публичное избранное: если есть JWT — по user, иначе по cookie vid */
  @Get('favorites')
  async favorites(@Req() req: ReqMaybeUser): Promise<ProductRow[]> {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    const owner = payload
      ? { customerId: payload.sub }
      : { visitorId: req.visitorId! };
    return this.likes.getFavorites(owner);
  }
}
