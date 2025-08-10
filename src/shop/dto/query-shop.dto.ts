// src/shop/dto/query-shop.dto.ts
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
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

export type SortKey = 'price' | 'rating' | 'popular' | 'new';
export type SortInput = `${'' | '-'}${SortKey}`;

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
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @IsPositive()
  categoryId?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @IsPositive()
  modelId?: number;

  @IsOptional()
  @Transform(toFloat)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  priceMin?: number;

  @IsOptional()
  @Transform(toFloat)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  priceMax?: number;

  @IsOptional()
  @IsString()
  @IsIn([
    'price',
    '-price',
    'rating',
    '-rating',
    'popular',
    '-popular',
    'new',
    '-new',
  ])
  sort?: SortInput = 'new';
}

export class GetShopParamsDto {
  @Transform(toInt)
  @IsInt()
  @IsPositive()
  id!: number;
}
