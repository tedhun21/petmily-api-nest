import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class FindLocationCountDto {
  @Type(() => Number)
  @IsNumber()
  size: number;
}
