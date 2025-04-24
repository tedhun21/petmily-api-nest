import { PaginationDto } from 'src/common/dto/pagination.dto';

export class FindPossiblePetsittersInput extends PaginationDto {
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  // petSpecies: string;
}
