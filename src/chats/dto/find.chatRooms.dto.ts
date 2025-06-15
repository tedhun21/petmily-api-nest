import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional } from 'class-validator';

export class FindChatRoomsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cursorId?: number;

  @IsOptional()
  @IsDate()
  cursorCreatedAt?: Date;

  @Type(() => Number)
  @IsNumber()
  pageSize: number;
}
