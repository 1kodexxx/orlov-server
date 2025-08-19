import {
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class ClientNotifyItemDto {
  @IsString()
  productName!: string;

  @IsOptional()
  @IsString()
  phoneModel?: string;

  @IsOptional()
  @IsString()
  colorName?: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0)
  lineTotal!: number;
}

export class ClientOrderNotifyDto {
  @IsArray()
  items!: ClientNotifyItemDto[];

  @IsNumber()
  @Min(0)
  totalAmount!: number;
}
