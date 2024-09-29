import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateReservationInput } from './dto/create.reservation.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { Reservation } from './entity/reservation.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateReservationInput } from './dto/update.reservation.dto';
import { PaginationInput } from 'src/common/dto/pagination.dto';
import { FindReservationsInput } from './dto/find.reservation.dto';
import { UserRole } from 'src/users/entity/user.entity';
import { ParamInput } from 'src/common/dto/param.dto';

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
        'Reservation already exists for the selected time',
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
        message: 'Successfully create a reservation',
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to create a reservation');
    }
  }

  async find(jwtUser: JwtUser, findReservationsInput: FindReservationsInput) {
    const { id: userId, role } = jwtUser;
    const { status, page, pageSize } = findReservationsInput;

    let whereCondition = {} as any;

    if (role) {
      if (role === UserRole.Client) {
        whereCondition.client = { id: userId };
      } else if (role === UserRole.Petsitter) {
        whereCondition.petsitter = { id: userId };
      }
    }

    if (status) {
      whereCondition.status = status;
    }

    try {
      const [reservations, total] =
        await this.reservationsRepository.findAndCount({
          where: whereCondition,
          relations: ['client', 'petsitter'],
          select: {
            client: { id: true, nickname: true, photo: true },
            petsitter: {
              id: true,
              nickname: true,
              photo: true,
              possibleDays: true,
              possibleLocations: true,
              possiblePetTypes: true,
              possibleStartTime: true,
              possibleEndTime: true,
            },
          },
          take: +pageSize,
          skip: (+page - 1) * +pageSize,
        });

      if (total === 0) {
        throw new NotFoundException('No pets found');
      }

      const totalPage = Math.ceil(total / +pageSize);

      return {
        results: reservations,
        pagination: { total, totalPage, page: +page, pageSize: +pageSize },
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch reservations');
    }
  }

  async findOne(jwtUser: JwtUser, params: ParamInput) {
    const { id: userId } = jwtUser;
    const { id: reservationId } = params;

    const reservation = await this.reservationsRepository.findOne({
      where: { id: +reservationId },
      relations: ['client', 'petsitter', 'journal', 'review'],
    });

    if (!reservation) {
      throw new NotFoundException('No reservation found');
    }

    if (
      reservation.client.id !== userId &&
      reservation.petsitter.id !== userId
    ) {
      throw new ForbiddenException(
        'You do not have permission to fetch this reservation',
      );
    }

    return reservation;
  }

  async update(
    jwtUser: JwtUser,
    params: ParamInput,
    updateReservationInput: UpdateReservationInput,
  ) {
    const { id: userId } = jwtUser;
    const { id: reservationId } = params;

    const reservation = await this.reservationsRepository.findOne({
      where: { id: +reservationId },
      relations: ['client', 'petsitter'],
    });

    if (!reservation) {
      throw new NotFoundException('No reservation found');
    }

    if (
      reservation.client.id !== userId &&
      reservation.petsitter.id !== userId
    ) {
      throw new ForbiddenException(
        "You don't have permission to update the reservation.",
      );
    }

    const updateReservationData = {
      ...reservation,
      ...updateReservationInput,
    };

    try {
      const updatedReservation = await this.reservationsRepository.save(
        updateReservationData,
      );

      return {
        id: updatedReservation.id,
        message: 'Successfully update the reservation',
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to update the reservation');
    }
  }
}
