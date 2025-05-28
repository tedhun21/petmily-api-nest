import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SearchDto {
  @IsString()
  index: string;

  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  size?: number;
}
