import { PaginationInput } from 'src/common/dto/pagination.dto';

export class FindMessageInput {
  opponentId: string;
  page: string;
  pageSize: string;
}
