// src/company-reviews/dto/update-company-review.dto.ts
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  Length,
  IsBoolean,
} from 'class-validator';

export class UpdateCompanyReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @Length(5, 4000)
  text?: string;

  // Только админ может менять флаг одобрения
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}
