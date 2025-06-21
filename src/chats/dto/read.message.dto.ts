import { IsDateString, IsNumber } from 'class-validator';

export class ReadMessageDto {
  @IsNumber()
  chatRoomId: number;

  @IsNumber()
  lastReadMessageId: number;

  @IsDateString()
  lastReadMessageCreatedAt: string;
}
