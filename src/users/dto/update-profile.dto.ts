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

  // 👇 добавь это поле
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}
