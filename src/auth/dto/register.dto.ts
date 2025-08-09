// src/auth/dto/register.dto.ts
import { IsEmail, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  @IsOptional()
  firstName?: string;

  @IsOptional()
  lastName?: string;
}
