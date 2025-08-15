import { IsString, Length } from 'class-validator';

export class CreateCompanyReviewDto {
  @IsString()
  @Length(5, 4000)
  text!: string; // только текст — рейтинга нет
}
