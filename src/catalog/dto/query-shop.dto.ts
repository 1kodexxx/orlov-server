// src/shop/dto/query-shop.dto.ts
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

const toInt = ({ value }: TransformFnParams): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? undefined : n;
};
const toFloat = ({ value }: TransformFnParams): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number.parseFloat(String(value));
  return Number.isNaN(n) ? undefined : n;
};
const toCsv = ({ value }: TransformFnParams): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

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
  @Transform(toInt)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @IsPositive()
  limit?: number = 24;

  /** Поиск */
  @IsOptional()
  @IsString()
  q?: string;

  /** Чипсы категорий/тегов — шлём слаги через запятую */
  @IsOptional()
  @Transform(toCsv)
  categories?: string[];

  /** Материалы / Коллекции / Популярность — также слаги (если это просто категории — фронт может передавать их сюда тоже) */
  @IsOptional()
  @Transform(toCsv)
  materials?: string[];

  @IsOptional()
  @Transform(toCsv)
  collections?: string[];

  @IsOptional()
  @Transform(toCsv)
  popularity?: string[];

  /** Диапазон цены */
  @IsOptional()
  @Transform(toFloat)
  @IsNumber()
  priceMin?: number;

  @IsOptional()
  @Transform(toFloat)
  @IsNumber()
  priceMax?: number;

  /** Сортировка */
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
  sort?: SortKey = 'relevance';
}

export class GetShopParamsDto {
  @Transform(toInt)
  @IsInt()
  @IsPositive()
  id!: number;
}
