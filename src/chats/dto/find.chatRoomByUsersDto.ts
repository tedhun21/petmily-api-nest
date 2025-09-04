import { Transform, Type } from 'class-transformer';
import { IsArray, IsNumber } from 'class-validator';

export class FindChatRoomByUsersDto {
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  opponentIds: number[];
}
