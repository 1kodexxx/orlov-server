import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FrontCheckoutItemDto {
  @IsString() slug!: string;
  @IsString() name!: string; // Название чехла
  @IsString() model!: string; // Модель телефона
  @IsString() color!: string; // Цвет
  @IsNumber() @Min(0) price!: number;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() image?: string | null;
}

export class FrontCheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrontCheckoutItemDto)
  items!: FrontCheckoutItemDto[];

  @IsNumber()
  @Min(0)
  total!: number;
}
