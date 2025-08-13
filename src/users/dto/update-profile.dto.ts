import { IsOptional, IsString, MaxLength, IsDateString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  homeAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deliveryAddress?: string | null;

  // дополнительный профиль
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  organization?: string | null;

  // уже существующие в БД поля
  @IsOptional()
  @IsDateString()
  birthDate?: string | null; // формат YYYY-MM-DD

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupPoint?: string | null;
}
