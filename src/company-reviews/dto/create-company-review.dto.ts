import { IsInt, Min, Max, IsString, Length } from 'class-validator';

export class CreateCompanyReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @Length(5, 4000)
  text!: string;
}
