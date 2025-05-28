import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { CreateReviewDto } from './dto/create.review.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Review } from './entity/review.entity';
import { EntityManager, IsNull, Not, Repository } from 'typeorm';
import { ReservationsService } from 'src/reservations/reservations.service';
import { ParamDto } from 'src/common/dto/param.dto';
import { UpdateReviewDto } from './dto/update.review.dto';
import { FindReviewsDto } from './dto/find.review.dto';
import { UploadsService } from 'src/uploads/uploads.service';
import { UsersService } from 'src/users/users.service';
import { UserRole } from 'src/users/entity/user.entity';
import { ReservationStatus } from 'src/reservations/entity/reservation.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    private readonly reservationsService: ReservationsService,
    private readonly uploadsService: UploadsService,
    private readonly usersService: UsersService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(
    jwtUser: JwtUser,
    createReviewDto: CreateReviewDto,
    files: Array<Express.Multer.File>,
  ) {
    const { id: userId, role } = jwtUser;
    const { reservationId, star } = createReviewDto;

    const reservation = await this.reservationsService.findOne(jwtUser, {
      id: reservationId,
    });

    if (!reservation) {
      throw new NotFoundException('No reservation found');
    }

    if (reservation.review) {
      throw new ConflictException('Review already exists for this reservation');
    }

    if (role !== UserRole.CLIENT || reservation.client.id !== userId) {
      throw new UnauthorizedException(
        "You don't have permission to create a review",
      );
    }

    if (reservation.status !== ReservationStatus.COMPLETED) {
      throw new UnprocessableEntityException(
        'Cannot create a review unless the reservation is completed',
      );
    }

    let photoUrls: string[] = [];
    if (files && files.length > 0) {
      photoUrls = await Promise.all(
        files.map(async (file) => await this.uploadsService.uploadFile(file)),
      );
    }

    // 트랜잭션 적용
    return await this.entityManager.transaction(async (manager) => {
      try {
        // ✅ 트랜잭션 내에서 review 객체 생성
        const review = manager.create(Review, {
          ...createReviewDto,
          reservation: { id: reservationId },
          ...(photoUrls.length > 0 && { photos: photoUrls }),
        });

        // ✅ review 저장
        const newReview = await manager.save(review);

        // ✅ 펫시터 별점 업데이트
        await this.usersService.updatePetsitterStar(
          reservation.petsitter.id,
          star,
          manager,
          true,
        );

        return { id: newReview.id, message: 'Successfully created review' };
      } catch (e) {
        throw new InternalServerErrorException('Failed to create a review');
      }
    });
  }

  async find(findReviewsDto: FindReviewsDto) {
    const { photo, page, pageSize } = findReviewsDto;

    const whereCondition = {} as any;
    if (photo === true) {
      whereCondition.photos = Not(IsNull()); // 사진 있는 리뷰만
    } else if (photo === false) {
      whereCondition.photos = IsNull(); // 사진 없는 리뷰만
    }

    try {
      const [reviews, total] = await this.reviewsRepository.findAndCount({
        where: whereCondition,
        order: { createdAt: 'desc' },
        relations: [
          'reservation.client',
          'reservation.pets',
          'reservation.petsitter',
        ],
        select: {
          reservation: {
            id: true,
            client: { id: true, nickname: true, photo: true },
            petsitter: { id: true, nickname: true, photo: true },
          },
        },
        take: +pageSize,
        skip: (+page - 1) * +pageSize,
      });

      const totalPages = Math.ceil(total / +pageSize);

      return {
        results: reviews,
        pagination: { total, totalPages, page: +page, pageSize: +pageSize },
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch reviews');
    }
  }

  async findOne(params: ParamDto) {
    const { id: reviewId } = params;

    try {
      const review = await this.reviewsRepository.findOne({
        where: { id: +reviewId },
      });

      if (!review) {
        throw new NotFoundException('No review found');
      }

      return review;
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch the review');
    }
  }

  async update(
    jwtUser: JwtUser,
    params: ParamDto,
    updateReviewDto: UpdateReviewDto,
    files: Array<Express.Multer.File>,
  ) {
    const { id: userId, role } = jwtUser;
    const { id: reviewId } = params;
    const { deletePhotos, star, body } = updateReviewDto;

    // 트랜잭션 적용
    return this.entityManager.transaction(async (manager) => {
      // 기존 리뷰 찾기
      const review = await this.reviewsRepository.findOne({
        where: { id: +reviewId },
        relations: ['reservation.client', 'reservation.petsitter'],
      });

      // 리뷰 없으면 에러
      if (!review) {
        throw new NotFoundException('No review found');
      }

      const { client } = review.reservation;
      // 예약에서 Client가 같지 않으면 에러
      if (role !== UserRole.CLIENT && client.id !== userId) {
        throw new UnauthorizedException(
          "You don't have permission to update the review",
        );
      }

      review.photos = review.photos ?? [];
      // 삭제할 파일 처리
      if (deletePhotos && deletePhotos.length > 0) {
        await Promise.all(
          deletePhotos.map(
            async (file) => await this.uploadsService.deleteFile({ url: file }),
          ),
        );

        review.photos = review.photos.filter(
          (url: string) => !deletePhotos.includes(url),
        );
      }

      // 새파일 업로드
      if (files && files.length > 0) {
        const newPhotoUrls = await Promise.all(
          files.map(async (file) => await this.uploadsService.uploadFile(file)),
        );
        review.photos = [...review.photos, ...newPhotoUrls];
      }

      // 리뷰 데이터 업데이트
      review.body = body;
      review.star = star;

      try {
        await manager.save(review);

        await this.usersService.updatePetsitterStar(
          review.reservation.petsitter.id,
          star,
          manager,
          false,
        );

        return {
          id: review.id,
          message: 'Successfully update the review',
        };
      } catch (e) {
        throw new InternalServerErrorException('Fail to update the review');
      }
    });
  }

  async delete(jwtUser: JwtUser, paramDto: ParamDto) {
    const { id: userId, role } = jwtUser;
    const { id: reviewId } = paramDto;

    const review = await this.reviewsRepository.findOne({
      where: { id: +reviewId },
      relations: ['reservation.client'],
      select: { id: true, reservation: { id: true, client: { id: true } } },
    });

    if (!review) {
      throw new NotFoundException('No review found');
    }

    const { client } = review.reservation;
    if (role !== UserRole.CLIENT || client.id !== userId) {
      throw new ForbiddenException(
        "You don't have permission to delete the review",
      );
    }

    try {
      await this.reviewsRepository.delete(reviewId);

      return { id: +reviewId, message: 'Successfully delete the review' };
    } catch (e) {
      throw new InternalServerErrorException('Fail to delete thre review');
    }
  }

  async findByPetsitter(params, query) {
    const { nickname } = params;
    const { page, pageSize } = query;

    const [reviews, total] = await this.reviewsRepository.findAndCount({
      where: { reservation: { petsitter: { nickname } } },
      relations: ['reservation', 'reservation.client'],
      select: {
        reservation: {
          id: true,
          client: {
            id: true,
            nickname: true,
            photo: true,
          },
        },
      },

      skip: (+page - 1) * +pageSize,
      take: +pageSize,
    });

    const totalPages = Math.ceil(total / +pageSize);

    return {
      results: reviews,
      pagination: {
        total,
        totalPages,
        page: +page,
        pageSize: +pageSize,
      },
    };
  }
}
