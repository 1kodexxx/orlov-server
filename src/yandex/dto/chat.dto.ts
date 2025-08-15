import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}
