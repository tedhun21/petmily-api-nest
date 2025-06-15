import { IsNumber } from 'class-validator';
import { Message } from '../entity/message.entity';

export class ReadMessageDto {
  @IsNumber()
  chatRoomId: number;

  lastSeenMessage: Message;
}
