import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { CompanyReviewsService } from './company-reviews.service';
import { CreateCompanyReviewDto } from './dto/create-company-review.dto';
import { UpdateCompanyReviewDto } from './dto/update-company-review.dto';
import { QueryCompanyReviewDto } from './dto/query-company-review.dto';

import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload, isJwtPayload } from '../auth/types';

function getJwtUser(req: Request): JwtPayload {
  if (!isJwtPayload(req.user)) throw new UnauthorizedException();
  return req.user;
}

@Controller('company-reviews')
export class CompanyReviewsController {
  constructor(private readonly service: CompanyReviewsService) {}

  // Публичный список: ТЕПЕРЬ ПО УМОЛЧАНИЮ — БЕЗ МОДЕРАЦИИ (все отзывы)
  @Get()
  async list(@Query() q: QueryCompanyReviewDto) {
    // если approved не передан — показываем все
    const approvedOnly = q.approved ? q.approved === 'true' : false;
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const data = await this.service.findAll(approvedOnly, page, limit);

    return {
      ...data,
      items: data.items.map((r) => ({
        id: r.id,
        text: r.text,
        rating: r.rating,
        isApproved: r.isApproved,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        author: {
          id: r.customer.id,
          fullName: `${r.customer.firstName} ${r.customer.lastName}`.trim(),
          email: r.customer.email,
          avatarUrl: r.customer.avatarUrl ?? null,
          headline: r.customer.headline ?? null,
          organization: r.customer.organization ?? null,
        },
      })),
    };
  }

  // Мои отзывы
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async mine(@Req() req: Request, @Query() q: QueryCompanyReviewDto) {
    const user = getJwtUser(req);
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    return this.service.findMine(user.sub, page, limit);
  }

  // Создать от своего имени
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateCompanyReviewDto) {
    const user = getJwtUser(req);
    return this.service.create(dto, user.sub);
  }

  // Обновить: владелец или админ (без привязки к isApproved)
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateCompanyReviewDto,
  ) {
    const user = getJwtUser(req);
    return this.service.update(id, dto, { id: user.sub, role: user.role });
  }

  // Одобрить (admin) — оставляем как no-op опцию (или можно удалить эндпоинт)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: Request) {
    const user = getJwtUser(req);
    return this.service.approve(id, user.role);
  }

  // Удалить: владелец или админ (без учета isApproved)
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = getJwtUser(req);
    await this.service.remove(id, { id: user.sub, role: user.role });
    return { success: true };
  }
}
