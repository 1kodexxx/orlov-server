import { IsEmail, MinLength, IsString, Length, Matches } from 'class-validator';

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

  /**
   * Российский номер телефона.
   * Разрешаем два «нормализованных» формата: +7XXXXXXXXXX или 8XXXXXXXXXX (ровно 11 цифр).
   * Перед сохранением всё равно нормализуем в формат +7XXXXXXXXXX.
   */
  @Matches(/^(?:\+7|8)\d{10}$/, {
    message:
      'Телефон должен быть российским номером в формате +7XXXXXXXXXX или 8XXXXXXXXXX',
  })
  phone!: string;
}
