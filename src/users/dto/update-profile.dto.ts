// src/users/dto/update-profile.dto.ts
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(5, 20)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  homeAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}
