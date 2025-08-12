import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { FavoritesService } from './favorites.service';
import { JwtOptionalAuthGuard } from '../auth/guards';
import { isJwtPayload, type JwtPayload } from '../auth/types';
import type { ProductRow } from '../catalog/catalog.service';

type ReqMaybeUser = Request & { user?: unknown; visitorId?: string };

@Controller('favorites')
@UseGuards(JwtOptionalAuthGuard) // если есть Bearer — будет user, иначе — гость
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  /** Список товаров в избранном (публично) */
  @Get()
  async list(@Req() req: ReqMaybeUser): Promise<ProductRow[]> {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    const owner = payload
      ? { customerId: payload.sub }
      : { visitorId: req.visitorId ?? null };
    return this.favorites.getFavorites(owner);
  }

  /** Только id-шники (по желанию фронта) */
  @Get('ids')
  async ids(@Req() req: ReqMaybeUser): Promise<{ ids: number[] }> {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    const owner = payload
      ? { customerId: payload.sub }
      : { visitorId: req.visitorId ?? null };
    const ids = await this.favorites.getFavoriteIds(owner);
    return { ids };
  }
}
