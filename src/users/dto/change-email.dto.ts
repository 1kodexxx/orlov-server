import { IsEmail, MaxLength } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
