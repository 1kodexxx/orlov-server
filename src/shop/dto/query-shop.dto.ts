import { Transform } from 'class-transformer';
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

const toInt = ({ value }: { value: any }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : parseInt(value, 10);

const toFloat = ({ value }: { value: any }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : parseFloat(value);

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
  @IsNumber()
  priceMin?: number;

  @IsOptional()
  @Transform(toFloat)
  @IsNumber()
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
