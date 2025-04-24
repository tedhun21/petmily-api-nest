import { PaginationDto } from 'src/common/dto/pagination.dto';

export class FindReviewsInput extends PaginationDto {
  photo?: 'true' | 'false';
}
