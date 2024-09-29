import { PaginationInput } from 'src/common/dto/pagination.dto';

export class FindPossiblePetsittersInput extends PaginationInput {
  date: string;
  startTime: string;
  endTime: string;
  address: string;
  petType: string[];
}
