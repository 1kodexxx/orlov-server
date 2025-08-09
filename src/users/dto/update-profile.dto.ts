import { IsOptional, IsString, Length, IsPhoneNumber } from 'class-validator';

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
  @IsPhoneNumber('RU', { message: 'Некорректный номер телефона' })
  phone?: string;
}
