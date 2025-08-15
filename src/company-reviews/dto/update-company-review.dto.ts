// src/company-reviews/dto/update-company-review.dto.ts
import { IsOptional, IsString, Length, IsBoolean } from 'class-validator';

export class UpdateCompanyReviewDto {
  @IsOptional()
  @IsString()
  @Length(5, 4000)
  text?: string;

  @IsOptional()
  @IsBoolean()
  isApproved?: boolean; // меняет только админ (проверка в сервисе)
}
