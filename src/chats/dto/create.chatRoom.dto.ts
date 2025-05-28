import { IsArray, IsNumber } from 'class-validator';

export class CreateChatRoomDto {
  @IsArray()
  @IsNumber({}, { each: true })
  opponentIds: number[];
}
