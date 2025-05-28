import { PartialType } from '@nestjs/mapped-types';
import { CreateReservationDto } from './create.reservation.dto';
import { ReservationStatus } from '../entity/reservation.entity';
import { IsEnum } from 'class-validator';

export class UpdateReservationDto extends PartialType(CreateReservationDto) {
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}
