import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class FindReviewsDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  photo?: boolean;
}
