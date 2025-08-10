import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(200)
  newPassword!: string;
}
