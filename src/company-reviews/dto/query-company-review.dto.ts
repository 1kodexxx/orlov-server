import { Type } from 'class-transformer';
import { IsOptional, IsBooleanString, IsInt, Min } from 'class-validator';

export class QueryCompanyReviewDto {
  @IsOptional()
  @IsBooleanString()
  approved?: string; // 'true' | 'false'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
