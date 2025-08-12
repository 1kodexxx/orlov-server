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

type ReqMaybeUser = Request & { user?: unknown; visitorId?: string };

@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  /* -------- Каталог, карточка, мета -------- */

  @Get()
  async list(@Query() dto: QueryShopDto) {
    return this.service.findAll(dto);
  }

  @Get('meta')
  async meta() {
    return this.service.getMeta();
  }

  @Get(':id')
  async one(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  /* -------- Просмотры: публично -------- */

  @UseGuards(JwtOptionalAuthGuard)
  @Post(':id/view')
  @HttpCode(200)
  async addView(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ReqMaybeUser,
  ) {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;

    const customerId = payload?.sub ?? null;
    const visitorId = req.visitorId ?? null;

    const ip = String(
      (req.headers['x-forwarded-for'] as string | undefined) ??
        req.socket.remoteAddress ??
        '',
    );
    const ua = String(req.headers['user-agent'] ?? '').trim();

    return this.service.addView(id, customerId, visitorId, ip, ua);
  }

  /* -------- Лайки: публично (user || visitorId) -------- */

  @UseGuards(JwtOptionalAuthGuard)
  @Post(':id/like')
  async like(@Param('id', ParseIntPipe) id: number, @Req() req: ReqMaybeUser) {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    const owner = payload
      ? { customerId: payload.sub }
      : { visitorId: req.visitorId ?? null };
    return this.service.likePublic(id, owner);
  }

  @UseGuards(JwtOptionalAuthGuard)
  @Delete(':id/like')
  async unlike(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ReqMaybeUser,
  ) {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    const owner = payload
      ? { customerId: payload.sub }
      : { visitorId: req.visitorId ?? null };
    return this.service.unlikePublic(id, owner);
  }

  /** Публичное избранное: если есть JWT — по user, иначе — по cookie vid */
  @UseGuards(JwtOptionalAuthGuard)
  @Get('favorites')
  async favorites(@Req() req: ReqMaybeUser) {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    const owner = payload
      ? { customerId: payload.sub }
      : { visitorId: req.visitorId ?? null };
    return this.service.getFavoritesPublic(owner);
  }

  /* -------- Рейтинги: только авторизованным -------- */

  @UseGuards(JwtAuthGuard)
  @Post(':id/rating')
  async setRating(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRatingDto,
    @Req() req: ReqMaybeUser,
  ) {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    if (!payload) throw new BadRequestException();
    return this.service.setRating(id, payload.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/rating')
  async deleteRating(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ReqMaybeUser,
  ) {
    const payload: JwtPayload | null = isJwtPayload(req.user) ? req.user : null;
    if (!payload) throw new BadRequestException();
    return this.service.deleteRating(id, payload.sub);
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
