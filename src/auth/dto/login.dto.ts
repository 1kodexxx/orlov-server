// src/auth/dto/login.dto.ts
import { IsEmail, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  password!: string;
}
