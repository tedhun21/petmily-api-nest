import { IsArray, IsNumber, IsString } from 'class-validator';

export class SendMessageDto {
  @IsNumber()
  chatRoomId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  opponentIds: number[];

  @IsString()
  message: string;
}
