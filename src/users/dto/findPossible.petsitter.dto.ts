import { PaginationInput } from 'src/common/dto/pagination.dto';

export class FindPossiblePetsittersInput extends PaginationInput {
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  // petSpecies: string;
}
