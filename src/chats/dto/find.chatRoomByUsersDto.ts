import { Transform } from 'class-transformer';
import { IsArray, IsNumber } from 'class-validator';

export class FindChatRoomByUsersDto {
  @Transform(({ value }) => value.split(',').map(Number))
  @IsArray()
  @IsNumber({}, { each: true })
  opponentIds: number[];
}
