import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Post,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ShopService } from './shop.service';
import { GetShopParamsDto, QueryShopDto } from './dto/query-shop.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { SetRatingDto } from './dto/set-rating.dto';
import { JwtAuthGuard } from '../auth/guards';
import { JwtPayload, isJwtPayload } from '../auth/types';

type ReqWithMaybeUser = Request & { user?: JwtPayload };

// Безопасно достаём id пользователя из req.user (без any)
function uid(req: ReqWithMaybeUser): number | null {
  return isJwtPayload(req.user) ? req.user.sub : null;
}

@Controller('shop')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get()
  async list(@Query() query: QueryShopDto) {
    return this.shop.findAll(query);
  }

  @Get('search')
  async search(@Query() query: QueryShopDto) {
    return this.shop.findAll(query);
  }

  @Get(':id')
  async byId(@Param() params: GetShopParamsDto, @Req() req: ReqWithMaybeUser) {
    const item = await this.shop.findOne(params.id);
    const userId = uid(req);
    if (userId) {
      const [liked, userRating] = await Promise.all([
        this.shop.isLiked(params.id, userId),
        this.shop.userRatingFor(params.id, userId),
      ]);
      return { ...item, liked, userRating };
    }
    return item;
  }

  /** учёт просмотра — доступно всем (гость → cookie vid=uuid на фронте) */
  @Post(':id/view')
  async addView(@Param() p: GetShopParamsDto, @Req() req: ReqWithMaybeUser) {
    const visitorId = (req.cookies?.vid as string) || null;
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;
    const ua = req.headers['user-agent'] as string;
    await this.shop.addView(p.id, uid(req), visitorId, ip, ua);
    return { ok: true };
  }

  /** лайк/анлайк — только авторизованным */
  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  async like(@Param() p: GetShopParamsDto, @Req() req: ReqWithMaybeUser) {
    return this.shop.like(p.id, uid(req)!);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  async unlike(@Param() p: GetShopParamsDto, @Req() req: ReqWithMaybeUser) {
    return this.shop.unlike(p.id, uid(req)!);
  }

  /** рейтинг */
  @UseGuards(JwtAuthGuard)
  @Post(':id/rating')
  async setRating(
    @Param() p: GetShopParamsDto,
    @Body() dto: SetRatingDto,
    @Req() req: ReqWithMaybeUser,
  ) {
    return this.shop.setRating(p.id, uid(req)!, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/rating')
  async deleteRating(
    @Param() p: GetShopParamsDto,
    @Req() req: ReqWithMaybeUser,
  ) {
    return this.shop.deleteRating(p.id, uid(req)!);
  }

  /** комментарии */
  @Get(':id/comments')
  async listComments(
    @Param() p: GetShopParamsDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.shop.listComments(p.id, Number(page || 1), Number(limit || 20));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  async addComment(
    @Param() p: GetShopParamsDto,
    @Body() dto: AddCommentDto,
    @Req() req: ReqWithMaybeUser,
  ) {
    return this.shop.addComment(p.id, uid(req)!, dto);
  }

  /** meta */
  @Get('/_meta/categories')
  async categories() {
    return this.shop.getCategories();
  }

  @Get('/_meta/models')
  async models() {
    return this.shop.getPhoneModels();
  }
}
