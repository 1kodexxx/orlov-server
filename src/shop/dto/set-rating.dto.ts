// src/shop/dto/set-rating.dto.ts
import {
  IsInt,
  Max,
  Min,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SetRatingDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(5000) comment?: string;
}
