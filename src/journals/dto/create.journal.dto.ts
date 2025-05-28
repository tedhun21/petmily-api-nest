import { IsNumber, IsString } from 'class-validator';

export class CreateJournalDto {
  @IsNumber()
  reservationId: number;

  @IsString()
  body: string;
}
