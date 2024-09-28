import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateReservationInput } from './dto/create-reservation.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { Reservation } from './entity/reservation.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateReservationInput } from './dto/update-reservation.dto';
import { PaginationInput } from 'src/common/dto/pagination.dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
  ) {}
  async create(
    jwtUser: JwtUser,
    createReservationInput: CreateReservationInput,
  ) {
    const { id: userId } = jwtUser;
    const { date, startTime, endTime, petsitterId, petIds } =
      createReservationInput;

    const existingReservation = await this.reservationsRepository.findOne({
      where: {
        date,
        client: { id: userId },
        petsitter: { id: petsitterId },
        startTime: LessThan(endTime),
        endTime: MoreThan(startTime),
      },
    });

    if (existingReservation) {
      throw new ConflictException(
        'Reservation already exists for the selected time.',
      );
    }

    try {
      const reservation = this.reservationsRepository.create({
        ...createReservationInput,
        petsitter: { id: petsitterId },
        client: { id: userId },
        pets: petIds.map((id) => ({ id })),
      });

      const createdReservation =
        await this.reservationsRepository.save(reservation);

      return {
        id: createdReservation.id,
        message: 'Successfully create a reservation.',
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to create a reservation.');
    }
  }

  async find(jwtUser: JwtUser, pagination: PaginationInput) {
    const { id: userId } = jwtUser;
    const { page, pageSize } = pagination;

    try {
      const [reservations, total] =
        await this.reservationsRepository.findAndCount({
          where: { client: { id: userId } },
          take: pageSize,
          skip: (page - 1) * pageSize,
        });

      if (total === 0) {
        throw new NotFoundException('No pets found.');
      }

      const totalPage = Math.ceil(total / pageSize);

      return {
        results: reservations,
        pagination: { total, totalPage, page: +page, pageSize: +pageSize },
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch reservations.');
    }
  }

  async findOne(jwtUser: JwtUser, params: { id: string }) {
    const { id: userId } = jwtUser;
    const { id: reservationId } = params;

    const reservation = await this.reservationsRepository.findOne({
      where: { id: +reservationId },
      relations: ['client', 'petsitter'],
    });

    if (!reservation) {
      throw new NotFoundException('No reservation found.');
    }

    if (
      reservation.client.id !== userId &&
      reservation.petsitter.id !== userId
    ) {
      throw new ForbiddenException(
        'You do not have permission to fetch this reservation.',
      );
    }

    return reservation;
  }

  async update(
    jwtUser: JwtUser,
    params: { id: string },
    updateReservationInput: UpdateReservationInput,
  ) {
    const { id: userId } = jwtUser;
    const { id: reservationId } = params;

    const reservation = await this.reservationsRepository.findOne({
      where: { id: +reservationId },
      relations: ['client', 'petsitter'],
    });

    if (!reservation) {
      throw new NotFoundException('No reservation found.');
    }

    if (
      reservation.client.id !== userId &&
      reservation.petsitter.id !== userId
    ) {
      throw new ForbiddenException(
        "You don't have permission to update the reservation.",
      );
    }

    try {
      const updateReservationData = {
        ...reservation,
        ...updateReservationInput,
      };

      await this.reservationsRepository.save(updateReservationData);

      return {
        id: +reservationId,
        message: 'Successfully update the reservation.',
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to update the reservation.');
    }
  }
}
