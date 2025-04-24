import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ReservationStatus } from '../entity/reservation.entity';

export class FindReservationsDto extends PaginationDto {
  status?: ReservationStatus | 'all';
  date?: string;
}
