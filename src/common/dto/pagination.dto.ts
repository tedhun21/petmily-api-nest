import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PaginationInput {
  @Type(() => Number) // query에서는 string이어서 validate에 걸린다. 그걸 자동으로 transform에서 validate
  @IsInt()
  @Min(1)
  page: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number;
}
