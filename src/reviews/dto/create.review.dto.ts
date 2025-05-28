import { IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsNumber()
  reservationId: number;

  @IsString()
  body: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  star: number;
}
