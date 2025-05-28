import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class UpdateFavoriteDto {
  @Type(() => Number)
  @IsNumber()
  opponentId: number;

  @IsString()
  action: 'favorite' | 'unfavorite';
}
