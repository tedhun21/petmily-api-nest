import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString } from 'class-validator';

export class SendMessageDto {
  @IsNumber()
  chatRoomId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  opponentIds?: number[];

  @IsString()
  message: string;
}
