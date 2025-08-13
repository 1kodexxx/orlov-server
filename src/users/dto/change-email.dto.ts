// src/users/dto/change-email.dto.ts
import { IsEmail } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail()
  email!: string;
}
