// src/company-reviews/company-reviews.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CompanyReview } from './company-reviews.entity';

export type CompanyStats = {
  avg_company_rating: number;
  reviews_count: number;
};

type UpdatableFields = Partial<
  Pick<CompanyReview, 'rating' | 'text' | 'isApproved'>
>;

@Injectable()
export class CompanyReviewsService {
  constructor(
    @InjectRepository(CompanyReview)
    private readonly repo: Repository<CompanyReview>,
  ) {}

  async create(dto: { rating: number; text: string }, customerId: number) {
    const entity = this.repo.create({
      customerId,
      rating: dto.rating,
      text: dto.text,
      isApproved: false,
    });
    return this.repo.save(entity);
  }

  private baseQB(): SelectQueryBuilder<CompanyReview> {
    return this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.customer', 'u')
      .select([
        'r.id',
        'r.rating',
        'r.text',
        'r.isApproved',
        'r.createdAt',
        'r.updatedAt',
        'u.id',
        'u.firstName',
        'u.lastName',
        'u.email',
        'u.avatarUrl',
        'u.headline',
        'u.organization',
      ])
      .orderBy('r.createdAt', 'DESC');
  }

  async findAll(approvedOnly = true, page = 1, limit = 20) {
    const qb = this.baseQB();
    if (approvedOnly) qb.where('r.isApproved = :appr', { appr: true });
    qb.skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findMine(customerId: number, page = 1, limit = 20) {
    const qb = this.baseQB().where('r.customerId = :cid', { cid: customerId });
    qb.skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async update(
    id: string,
    dto: UpdatableFields,
    actor: { id: number; role: string },
  ) {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    const isOwner = review.customerId === actor.id;
    const isAdmin = actor.role === 'admin';

    if (isOwner && review.isApproved) {
      throw new ForbiddenException(
        'Approved review can be edited by admin only',
      );
    }
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You cannot edit this review');
    }

    // не-админу запрещаем менять isApproved — убираем поле без any
    const payload: UpdatableFields = !isAdmin
      ? (({ rating, text }) => ({ rating, text }))(dto)
      : dto;

    Object.assign(review, payload);
    return this.repo.save(review);
  }

  async approve(id: string, actorRole: string) {
    if (actorRole !== 'admin') throw new ForbiddenException('Admin only');
    const review = await this.repo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    review.isApproved = true;
    return this.repo.save(review);
  }

  async remove(id: string, actor: { id: number; role: string }) {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) return;
    const isOwner = review.customerId === actor.id;
    const isAdmin = actor.role === 'admin';

    if (review.isApproved && !isAdmin) {
      throw new ForbiddenException(
        'Approved review can be deleted by admin only',
      );
    }
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You cannot delete this review');
    }
    await this.repo.remove(review);
  }

  async stats(): Promise<CompanyStats> {
    const rows: Array<{
      avg_company_rating: string | number | null;
      reviews_count: string | number | null;
    }> = await this.repo.query(`SELECT * FROM company_rating_view`);

    const r = rows[0] ?? { avg_company_rating: 0, reviews_count: 0 };

    const avgRaw = r.avg_company_rating;
    const cntRaw = r.reviews_count;

    const avg =
      avgRaw == null
        ? 0
        : typeof avgRaw === 'string'
          ? parseFloat(avgRaw)
          : avgRaw;
    const count = cntRaw == null ? 0 : Number(cntRaw);

    return {
      avg_company_rating: Number.isFinite(avg) ? avg : 0,
      reviews_count: count,
    };
  }
}
