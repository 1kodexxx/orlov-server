// src/auth/dto/register.dto.ts
import { IsEmail, MinLength, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  password!: string;

  @IsString({ message: 'Имя должно быть строкой' })
  @Length(1, 100, { message: 'Имя должно быть от 1 до 100 символов' })
  firstName!: string;

  @IsString({ message: 'Фамилия должна быть строкой' })
  @Length(1, 100, { message: 'Фамилия должна быть от 1 до 100 символов' })
  lastName!: string;
}
