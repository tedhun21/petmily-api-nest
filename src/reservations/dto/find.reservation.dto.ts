import { PaginationInput } from 'src/common/dto/pagination.dto';
import { Status } from '../entity/reservation.entity';

export class FindReservationsInput extends PaginationInput {
  status?: Status;
}
