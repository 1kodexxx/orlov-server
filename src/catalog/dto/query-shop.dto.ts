import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export type SortKey =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'rating_desc'
  | 'rating_asc'
  | 'views_desc'
  | 'likes_desc'
  | 'newest'
  | 'name_asc'
  | 'name_desc';

export class QueryShopDto {
  @IsOptional()
  @IsString()
  q?: string;

  /** ЕДИНАЯ категория (slug), например ?category=government */
  @IsOptional()
  @IsString()
  category?: string;

  /** НЕСКОЛЬКО категорий (comma-separated slugs), например ?categories=men,women */
  @IsOptional()
  @Transform(({ value }) =>
    String(value || '')
      .split(',')
      .filter(Boolean),
  )
  @IsArray()
  categories?: string[];

  @IsOptional()
  @Transform(({ value }) =>
    String(value || '')
      .split(',')
      .filter(Boolean),
  )
  @IsArray()
  materials?: string[];

  @IsOptional()
  @Transform(({ value }) =>
    String(value || '')
      .split(',')
      .filter(Boolean),
  )
  @IsArray()
  collections?: string[];

  @IsOptional()
  @Transform(({ value }) =>
    String(value || '')
      .split(',')
      .filter(Boolean),
  )
  @IsArray()
  popularity?: string[];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsIn([
    'relevance',
    'price_asc',
    'price_desc',
    'rating_desc',
    'rating_asc',
    'views_desc',
    'likes_desc',
    'newest',
    'name_asc',
    'name_desc',
  ])
  sort?: SortKey;

  @IsOptional()
  @Transform(({ value }) => Number(value) || 1)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value) || 24)
  @IsInt()
  @Min(1)
  limit?: number;
}
