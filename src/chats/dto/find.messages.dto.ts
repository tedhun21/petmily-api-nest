import { Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class FindMessagesDto {
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  cursor?: number;

  @Type(() => Number)
  @IsNumber()
  pageSize: number;
}
