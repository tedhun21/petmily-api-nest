import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional } from 'class-validator';

export class FindChatRoomsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cursorId?: number;

  @IsOptional()
  @IsDateString()
  cursorDate?: string;

  @Type(() => Number)
  @IsNumber()
  pageSize: number;
}
