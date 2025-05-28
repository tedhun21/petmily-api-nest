import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional } from 'class-validator';

export class FindChatRoomsDto {
  @IsOptional()
  @IsDateString()
  cursor?: string;

  @Type(() => Number)
  @IsNumber()
  pageSize: number;
}
