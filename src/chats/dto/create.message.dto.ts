import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsOptional()
  @IsNumber()
  chatRoomId?: number;

  @IsOptional()
  @IsArray()
  opponentIds?: number[];

  @IsString()
  content: string;
}
