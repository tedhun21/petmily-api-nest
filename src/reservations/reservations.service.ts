import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { CreateReservationDto } from './dto/create.reservation.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import {
  Between,
  EntityManager,
  Equal,
  LessThan,
  MoreThan,
  Repository,
} from 'typeorm';
import { Reservation, ReservationStatus } from './entity/reservation.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateReservationDto } from './dto/update.reservation.dto';
import { FindReservationsDto } from './dto/find.reservation.dto';
import { User, UserRole } from 'src/users/entity/user.entity';
import { ParamDto } from 'src/common/dto/param.dto';
import { ClientKafka } from '@nestjs/microservices';
import { KafkaService } from 'src/kafka/kafka.service';
import { NotificationType } from 'src/notifications/entity/notification.entity';

@Injectable()
export class ReservationsService implements OnModuleInit {
  private producer: ClientKafka;

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly entityManager: EntityManager,
    private readonly kafkaService: KafkaService,
  ) {}

  async onModuleInit() {
    // kafak producer 초기화
    this.producer = this.kafkaService.getProducer();
  }

  async create(jwtUser: JwtUser, createReservationDto: CreateReservationDto) {
    const { id: userId } = jwtUser;
    const { date, startTime, endTime, petsitterId, petIds } =
      createReservationDto;

    const existingReservation = await this.reservationsRepository.findOne({
      where: {
        date: new Date(date),
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
        ...createReservationDto,
        petsitter: { id: petsitterId },
        client: { id: userId },
        pets: petIds.map((id) => ({ id })),
        status: ReservationStatus.PENDING,
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

  async find(jwtUser: JwtUser, findReservationsDto: FindReservationsDto) {
    const { id: userId, role } = jwtUser;
    const { date, status, page, pageSize } = findReservationsDto;

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
      // 월단위 YYYY-MM
      if (/^\d{4}-\d{2}$/.test(date)) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setMonth(endDate.getMonth() + 1);

        whereCondition.date = Between(startDate, endDate);
      }
      // 일단위 YYYY-MM-DD
      else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const targetDate = new Date(date);
        whereCondition.date = Equal(targetDate);
      }
    }

    if (status) {
      switch (status) {
        case ReservationStatus.PENDING:
          whereCondition.status = ReservationStatus.PENDING;
          break;
        case ReservationStatus.CANCELED:
          whereCondition.status = ReservationStatus.CANCELED;
          break;

        case ReservationStatus.ACCEPTED:
          whereCondition.status = ReservationStatus.ACCEPTED;
          break;

        case ReservationStatus.COMPLETED:
          whereCondition.status = ReservationStatus.COMPLETED;
          break;

        default:
          break;
      }
    }

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

  async findOne(jwtUser: JwtUser, params: ParamDto) {
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
    params: ParamDto,
    updateReservationDto: UpdateReservationDto,
  ) {
    const { id: userId } = jwtUser;
    const { id: reservationId } = params;
    const { status } = updateReservationDto;

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
      // 예약 상태 'completed'로 변경 시 펫시터 업데이트
      if (status === ReservationStatus.COMPLETED) {
        await manager.update(User, reservation.petsitter.id, {
          completedReservationsCount: () => 'completedReservationsCount + 1',
        });
      }

      // 예약 업데이트 데이터 생성
      const updateReservationData = {
        ...reservation,
        ...updateReservationDto,
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

  async getReservationWithReview(jwtUser: JwtUser, param: ParamDto) {
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

  async getReservationWithJournal(jwtUser: JwtUser, param: ParamDto) {
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

  async findMonthWithReservation(jwtUser: JwtUser) {
    const { id, role } = jwtUser;

    const roleColumn =
      role === UserRole.CLIENT
        ? 'clientId'
        : role === UserRole.PETSITTER
          ? 'petsitterId'
          : null;

    if (roleColumn) {
      const reservations = await this.reservationsRepository
        .createQueryBuilder('reservation')
        .select(
          'DISTINCT TO_CHAR(reservation.date, \'YYYY-MM\') AS "yearMonth"',
        ) // 1. reservation.date 필드를 'YYYY-MM' 형식으로 변화하여, 예약이 발생한 연도-월 형식으로 가져옴. 2. 이 값을 yearMonth라는 별칭으로 반환하며, 별칭은 큰 따옴표로 감싸서 정확히 대소문자를 구분하게 처리. 3. DISTINCT는 중복된 연-월 값들을 제거하기 위해 사용.
        .where(`reservation.${roleColumn} = :id`, { id }) // 역할에 맞는 예약 조회
        .orderBy('"yearMonth"', 'DESC') // 내림차순. 최신순.  큰 따옴표로 감싸서 정확한 별칭 사용
        .getRawMany(); // raw 데이터를 받아옴. 여러 행의 결과가 배열 형태로 반환

      return reservations.map((row) => row.yearMonth); // 'yearMonth'로 접근
    }

    return 'Invalid role';
  }

  // 예약 업데이트 알림 전송
  async updateAndNotify(
    reservationId: number,
    status: ReservationStatus,
    triggerUser: { id: number; role: UserRole },
  ) {
    const { role: userRole } = triggerUser;

    try {
      // 1️⃣ 예약 조회 및 상태 업데이트
      const reservation = await this.entityManager.findOne(Reservation, {
        where: { id: reservationId },
        relations: ['client', 'petsitter'],
        select: {
          client: { id: true, nickname: true },
          petsitter: { id: true, nickname: true },
        },
      });

      if (!reservation) {
        throw new NotFoundException('No reservation found');
      }

      reservation.status = status;
      await this.entityManager.save(reservation); // 트랜잭션 없이 저장

      const sender =
        userRole === UserRole.CLIENT
          ? reservation.client
          : reservation.petsitter;
      const receiver =
        userRole === UserRole.PETSITTER
          ? reservation.client
          : reservation.petsitter;

      // 2️⃣ Kafka 이벤트 전송
      await this.producer.emit('reservation-update', {
        referenceId: reservationId,
        senderId: sender.id,
        receiverIds: [receiver.id],
        type: NotificationType.RESERVATION_UPDATE,

        metadata: {
          reservationId,
          newStatus: status,
          sender: { id: sender.id, nickname: sender.nickname },
        },
      });
    } catch (e) {
      console.error('Error updating reservation:', e);
    }
  }
}
