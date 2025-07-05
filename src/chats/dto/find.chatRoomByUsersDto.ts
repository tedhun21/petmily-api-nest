import { Transform } from 'class-transformer';
import { IsArray, IsNumber } from 'class-validator';

export class FindChatRoomByUsersDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => value.split(',').map(Number))
  opponentIds: number[];
}
