import { PartialType } from '@nestjs/mapped-types';
import { Reservation } from '../entity/reservation.entity';

export class UpdateReservationInput extends PartialType(Reservation) {}
