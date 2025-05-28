import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class ParamDto {
  @Type(() => Number)
  @IsNumber()
  id: number;
}
