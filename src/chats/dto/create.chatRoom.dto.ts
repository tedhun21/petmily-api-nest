import { Type } from 'class-transformer';
import { IsArray, IsNumber } from 'class-validator';

export class CreateChatRoomDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  opponentIds: number[];
}
