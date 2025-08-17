import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type Role = 'system' | 'user' | 'assistant';

export class ChatMessageDto {
  @IsIn(['system', 'user', 'assistant'])
  role!: Role;

  @IsString()
  text!: string;
}

export class ChatDto {
  /** Необязательный системный промпт. Если не задан — будет дефолтный консультант магазина */
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  /** Сообщения диалога. Минимум одно (обычно от пользователя). */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  /** Переопределение температуры */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  temperature?: number;

  /** Переопределение лимита токенов ответа */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8192)
  @Type(() => Number)
  maxTokens?: number;

  /** Стримить ли ответ (SSE) */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  stream?: boolean;
}
