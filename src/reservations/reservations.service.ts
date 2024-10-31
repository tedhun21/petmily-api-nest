import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateReservationInput } from './dto/create.reservation.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { EntityManager, In, LessThan, MoreThan, Repository } from 'typeorm';
import { Reservation, Status } from './entity/reservation.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateReservationInput } from './dto/update.reservation.dto';
import { FindReservationsInput } from './dto/find.reservation.dto';
import { User, UserRole } from 'src/users/entity/user.entity';
import { ParamInput } from 'src/common/dto/param.dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly entityManager: EntityManager,
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
      console.log(e);
      throw new InternalServerErrorException('Fail to create a reservation');
    }
  }

  async find(jwtUser: JwtUser, findReservationsInput: FindReservationsInput) {
    const { id: userId, role } = jwtUser;
    const { order, status, page, pageSize } = findReservationsInput;

    let whereCondition = {} as any;
    let orderCondition = {} as any;

    if (role) {
      if (role === UserRole.CLIENT) {
        whereCondition.client = { id: userId };
      } else if (role === UserRole.PETSITTER) {
        whereCondition.petsitter = { id: userId };
      }
    }

    if (order) {
      switch (order) {
        case 'asc':
          orderCondition.createdAt = 'asc';
          break;
        case 'desc':
          orderCondition.createdAt = 'desc';
          break;
      }
    }

    if (status) {
      switch (status) {
        case 'expected':
          whereCondition.status = In([Status.PENDING, Status.ACCEPTED]); // 대기중 및 진행중 상태
          break;
        case 'done':
          whereCondition.status = In([Status.CANCELED, Status.COMPLETED]); // 취소 및 완료 상태
          break;
        case 'all':
          break;
        default:
          whereCondition.status = status;
          break;
      }
    }

    try {
      const [reservations, total] =
        await this.reservationsRepository.findAndCount({
          where: whereCondition,
          order: orderCondition,
          relations: ['client', 'petsitter'],
          select: {
            client: { id: true, nickname: true, photo: true },
            petsitter: {
              id: true,
              nickname: true,
              photo: true,
              possibleDays: true,
              possibleLocations: true,
              possiblePetSpecies: true,
              possibleStartTime: true,
              possibleEndTime: true,
            },
          },
          take: +pageSize,
          skip: (+page - 1) * +pageSize,
        });

      const totalPages = Math.ceil(total / +pageSize);

      return {
        results: reservations,
        pagination: { total, totalPages, page: +page, pageSize: +pageSize },
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
      select: {
        client: { id: true, username: true, nickname: true, photo: true },
        petsitter: {
          id: true,
          username: true,
          nickname: true,
          photo: true,
          star: true,
          reviewCount: true,
          possibleDays: true,
          possibleLocations: true,
          possiblePetSpecies: true,
          possibleStartTime: true,
          possibleEndTime: true,
        },
      },
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
    const { status } = updateReservationInput;

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

    // 트랜잭션 시작
    return this.entityManager.transaction(async (manager) => {
      // 예약 상태 'Completed'로 변경 시 펫시터 업데이트
      if (status === 'Completed') {
        await manager.update(User, reservation.petsitter.id, {
          completedReservationsCount: () => 'completedReservationsCount + 1',
        });
      }

      // 예약 업데이트 데이터 생성
      const updateReservationData = {
        ...reservation,
        ...updateReservationInput,
      };

      try {
        // 예약 상태 업데이트
        const updatedReservation = await manager.save(
          this.reservationsRepository.create(updateReservationData),
        );

        return {
          id: updatedReservation.id,
          message: 'Successfully update the reservation',
        };
      } catch (e) {
        throw new InternalServerErrorException(
          'Fail to update the reservation',
        );
      }
    });
  }

  async getReviewByReservation(jwtUser: JwtUser, params: ParamInput) {
    const { id: userId } = jwtUser;
    const { id: reservationId } = params;

    try {
      const reservation = await this.reservationsRepository.findOne({
        where: { id: +reservationId, client: { id: userId } },
        relations: ['review'],
        select: { review: { id: true } },
      });

      return reservation.review;
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch review');
    }
  }
}
