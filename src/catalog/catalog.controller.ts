// src/catalog/catalog.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { CatalogService } from './catalog.service';
import { QueryShopDto } from './dto/query-shop.dto';
import { SetRatingDto } from './dto/set-rating.dto';
import { AddCommentDto } from './dto/add-comment.dto';

import { JwtAuthGuard, JwtOptionalAuthGuard } from '../auth/guards';
import { isJwtPayload, type JwtPayload } from '../auth/types';

/** Request, в котором user может отсутствовать, а visitorId подставляется middleware */
type ReqMaybeUser = Request & { user?: unknown; visitorId?: string | null };

/** Утилита: определить владельца действия (авторизованный пользователь либо гость) */
function pickOwner(
  req: ReqMaybeUser,
):
  | { customerId: number; visitorId: null }
  | { customerId: null; visitorId: string | null } {
  const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
  if (payload) {
    return { customerId: payload.sub, visitorId: null };
  }
  return { customerId: null, visitorId: req.visitorId ?? null };
}

@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  /* -------- Каталог, мета, карточка -------- */

  @Get()
  async list(@Query() dto: QueryShopDto) {
    return this.service.findAll(dto);
  }

  @Get('meta')
  async meta() {
    return this.service.getMeta();
  }

  // Детальная: вернём также liked/myRating для текущего владельца
  @UseGuards(JwtOptionalAuthGuard)
  @Get(':id')
  async one(@Param('id', ParseIntPipe) id: number, @Req() req: ReqMaybeUser) {
    const owner = pickOwner(req);
    const row = await this.service.findOne(id);

    let liked = false;
    let myRating = 0;

    if (owner.customerId) {
      liked = await this.service.isLiked(id, owner.customerId);
      myRating = (await this.service.userRatingFor(id, owner.customerId)) ?? 0;
    } else if (owner.visitorId) {
      // для гостя проверим лайк/рейтинг напрямую
      const likedRows = await this.service['ds'].query<
        Array<Record<string, never>>
      >(
        `SELECT 1 FROM product_like WHERE product_id=$1 AND visitor_id=$2 LIMIT 1`,
        [id, owner.visitorId],
      );
      liked = likedRows.length > 0;

      const r = await this.service['ds'].query<Array<{ rating: number }>>(
        `SELECT rating FROM review WHERE product_id=$1 AND visitor_id=$2 LIMIT 1`,
        [id, owner.visitorId],
      );
      myRating = r[0]?.rating ?? 0;
    }

    return { ...row, liked, myRating };
  }

  /* -------- Просмотры: засчитываем ТОЛЬКО на детальной странице -------- */

  @UseGuards(JwtOptionalAuthGuard)
  @Post(':id/view')
  @HttpCode(200)
  async addView(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ReqMaybeUser,
  ) {
    const owner = pickOwner(req);

    const ip = String(
      (req.headers['x-forwarded-for'] as string | undefined) ??
        req.socket.remoteAddress ??
        '',
    );
    const ua = String(req.headers['user-agent'] ?? '').trim();

    return this.service.addView(id, {
      customerId: owner.customerId,
      visitorId: owner.visitorId,
      ip,
      userAgent: ua,
    });
  }

  /* -------- Лайки: доступны всем (user || visitorId) -------- */

  @UseGuards(JwtOptionalAuthGuard)
  @Post(':id/like')
  async like(@Param('id', ParseIntPipe) id: number, @Req() req: ReqMaybeUser) {
    const owner = pickOwner(req);
    return this.service.likePublic(id, owner);
  }

  @UseGuards(JwtOptionalAuthGuard)
  @Delete(':id/like')
  async unlike(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ReqMaybeUser,
  ) {
    const owner = pickOwner(req);
    return this.service.unlikePublic(id, owner);
  }

  /** Публичное «избранное» на базе лайков */
  @UseGuards(JwtOptionalAuthGuard)
  @Get('favorites')
  async favorites(@Req() req: ReqMaybeUser) {
    const owner = pickOwner(req);
    return this.service.getFavoritesPublic(owner);
  }

  /* -------- Рейтинг: доступен всем (user || visitorId) -------- */

  @UseGuards(JwtOptionalAuthGuard)
  @Post(':id/rating')
  async setRating(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRatingDto,
    @Req() req: ReqMaybeUser,
  ) {
    const owner = pickOwner(req);
    return this.service.setRatingPublic(id, owner, dto);
  }

  @UseGuards(JwtOptionalAuthGuard)
  @Delete(':id/rating')
  async deleteRating(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ReqMaybeUser,
  ) {
    const owner = pickOwner(req);
    return this.service.deleteRatingPublic(id, owner);
  }

  /* -------- Комментарии -------- */

  @Get(':id/comments')
  async listComments(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    return this.service.listComments(id, p, l);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  async addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddCommentDto,
    @Req() req: ReqMaybeUser,
  ) {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    if (!payload) throw new BadRequestException();
    return this.service.addComment(id, payload.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentId')
  async deleteComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() req: ReqMaybeUser,
  ) {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    if (!payload) throw new BadRequestException();
    return this.service.deleteComment(commentId, payload.sub);
  }
}
