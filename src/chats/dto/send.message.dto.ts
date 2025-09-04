import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  tempChatRoomId: string;

  @IsOptional()
  @IsNumber()
  chatRoomId?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  opponentIds?: number[];

  @IsString()
  tempMessageId: string;

  @IsString()
  content: string;
}
