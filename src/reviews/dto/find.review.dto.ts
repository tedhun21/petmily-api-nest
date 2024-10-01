import { PaginationInput } from 'src/common/dto/pagination.dto';

export class FindReviewsInput extends PaginationInput {
  photo?: 'true' | 'false';
}
