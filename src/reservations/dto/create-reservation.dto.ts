import { PickType } from '@nestjs/mapped-types';
import { Reservation } from '../entity/reservation.entity';

export class CreateReservationInput extends PickType(Reservation, [
  'date',
  'startTime',
  'endTime',
  'address',
]) {
  petsitterId: number;
  petIds: number[];
}
