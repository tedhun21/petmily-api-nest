import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateReservationInput } from './dto/create.reservation.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import {
  Between,
  EntityManager,
  LessThan,
  MoreThan,
  Repository,
} from 'typeorm';
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
    const { date, status, page, pageSize } = findReservationsInput;

    console.log('date: ', date);

    const whereCondition = {} as any;
    // const dateCondition = {} as any;

    if (role) {
      if (role === UserRole.CLIENT) {
        whereCondition.client = { id: userId };
      } else if (role === UserRole.PETSITTER) {
        whereCondition.petsitter = { id: userId };
      }
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setMonth(endDate.getMonth() + 1);

      whereCondition.date = Between(startDate, endDate);
    }

    if (status) {
      switch (status) {
        case Status.PENDING:
          whereCondition.status = Status.PENDING;
          break;
        case Status.CANCELED:
          whereCondition.status = Status.CANCELED;
          break;

        case Status.ACCEPTED:
          whereCondition.status = Status.ACCEPTED;
          break;

        case Status.COMPLETED:
          whereCondition.status = Status.COMPLETED;
          break;

        default:
          break;
      }
    }
    console.log(whereCondition);

    try {
      const [reservations, total] =
        await this.reservationsRepository.findAndCount({
          where: whereCondition,
          relations: ['client', 'petsitter', 'pets'],
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
      relations: ['client', 'petsitter', 'journal', 'review', 'pets'],
      select: {
        client: {
          id: true,
          username: true,
          nickname: true,
          photo: true,
        },
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

  async getReservationWithReview(jwtUser: JwtUser, param: ParamInput) {
    const { id: userId } = jwtUser;
    const { id: reservationId } = param;

    try {
      const reservation = await this.reservationsRepository.findOne({
        where: { id: +reservationId, client: { id: userId } },
        relations: ['review'],
        select: { id: true },
      });

      if (!reservation.review) {
        throw new NotFoundException('No review found');
      }

      return reservation.review;
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch review');
    }
  }

  async getReservationWithJournal(jwtUser: JwtUser, param: ParamInput) {
    const { id: userId } = jwtUser;
    const { id: reservationId } = param;

    try {
      const reservation = await this.reservationsRepository.findOne({
        where: { id: +reservationId, petsitter: { id: userId } },
        relations: ['journal'],
        select: { id: true },
      });

      if (!reservation.journal) {
        throw new NotFoundException('No jounral found');
      }

      return reservation.journal;
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch journal');
    }
  }

  async findByPetsitterForDay(param, query) {
    const { id: petsitterId } = param;
    const { date } = query;

    const whereCondition = { petsitter: { id: petsitterId } } as any;

    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0); // 날짜만 비교할 경우 시간 초기화

      whereCondition.date = targetDate; // 같은 날짜로 조건 설정
    }

    const reservations = await this.reservationsRepository.find({
      where: whereCondition,
      select: ['id', 'date', 'startTime', 'endTime'],
    });

    return reservations;
  }
}
