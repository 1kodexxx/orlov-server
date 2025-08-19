import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ClientOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productName!: string; // напр. "Чехол 'Имперский синий'"

  @IsString()
  @IsOptional()
  phoneModel?: string; // напр. "iPhone 14 Pro"

  @IsString()
  @IsOptional()
  colorName?: string; // напр. "Красный"  ← используем слово

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  price!: number; // цена за единицу (для подписи)

  @IsNumber()
  @Min(0)
  lineTotal!: number; // quantity * price
}

export class ClientOrderNotifyDto {
  @IsArray()
  items!: ClientOrderItemDto[];

  @IsNumber()
  @Min(0)
  totalAmount!: number; // общая сумма
}
