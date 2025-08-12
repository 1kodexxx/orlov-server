// src/shop/dto/add-comment.dto.ts
import { IsString, Length } from 'class-validator';

export class AddCommentDto {
  @IsString()
  @Length(1, 5000)
  text!: string;
}
