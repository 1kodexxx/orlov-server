import {
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class FrontCheckoutItemDto {
  @IsString()
  productName!: string;

  @IsOptional()
  @IsString()
  phoneModel?: string;

  @IsOptional()
  @IsString()
  colorName?: string; // человекочитаемый цвет (например, «Чёрный»), можно и hex

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0)
  lineTotal!: number; // сумма по позиции (qty * price)
}

export class FrontCheckoutDto {
  @IsArray()
  items!: FrontCheckoutItemDto[];

  @IsNumber()
  @Min(0)
  totalAmount!: number;
}
