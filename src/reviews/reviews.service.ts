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
import { CreateReviewInput } from './dto/create.review.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Review } from './entity/reivew.entity';
import { IsNull, Not, Repository } from 'typeorm';
import { ReservationsService } from 'src/reservations/reservations.service';
import { ParamInput } from 'src/common/dto/param.dto';
import { UpdateReviewInput } from './dto/update.review.dto';
import { FindReviewsInput } from './dto/find.review.dto';
import { UploadsService } from 'src/uploads/uploads.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    private readonly reservationsService: ReservationsService,
    private readonly uploadsService: UploadsService,
  ) {}
  async create(
    jwtUser: JwtUser,
    createReviewInput: CreateReviewInput,
    files: Array<Express.Multer.File>,
  ) {
    const { id: userId, role } = jwtUser;
    const { reservationId } = createReviewInput;

    const reservation = await this.reservationsService.findOne(jwtUser, {
      id: reservationId,
    });

    if (!reservation) {
      throw new NotFoundException('No reservation found');
    }

    if (reservation.review) {
      throw new ConflictException('Review already exists for this reservation');
    }

    if (role !== 'Client' || reservation.client.id !== userId) {
      throw new UnauthorizedException(
        "You don't have permission to create a review",
      );
    }

    if (reservation.status !== 'Completed') {
      throw new UnprocessableEntityException(
        'Cannot create a review unless the reservation is completed',
      );
    }

    let photoUrls = null;
    if (files && files.length > 0) {
      photoUrls = await Promise.all(
        files.map(async (file) => await this.uploadsService.uploadFile(file)),
      );
    }

    const review = this.reviewsRepository.create({
      ...createReviewInput,
      reservation: { id: reservationId },
      ...(photoUrls.length && { photos: photoUrls }),
    });

    try {
      const newReview = await this.reviewsRepository.save(review);

      return { id: newReview.id, message: 'Successfully create a review' };
    } catch (e) {
      throw new InternalServerErrorException('Fail to create a review');
    }
  }

  async find(findReviewsInput: FindReviewsInput) {
    const { photo, page, pageSize } = findReviewsInput;

    let whereCondition = {} as any;
    if (photo === 'true') {
      whereCondition.photos = Not(IsNull());
    }

    try {
      const [reviews, total] = await this.reviewsRepository.findAndCount({
        where: whereCondition,
        order: { createdAt: 'desc' },
        relations: ['reservation.client'],
        select: {
          reservation: {
            id: true,
            client: { id: true, nickname: true, photo: true },
          },
        },
        take: +pageSize,
        skip: (+page - 1) * +pageSize,
      });

      const totalPage = Math.ceil(total / +pageSize);

      return {
        results: reviews,
        pagination: { total, totalPage, page: +page, pageSize: +pageSize },
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch reviews');
    }
  }

  async findOne(params: ParamInput) {
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
    params: ParamInput,
    updateReviewInput: UpdateReviewInput,
    files: Array<Express.Multer.File>,
  ) {
    const { id: userId, role } = jwtUser;
    const { id: reviewId } = params;
    const { deleteFiles, body } = updateReviewInput;

    const review = await this.reviewsRepository.findOne({
      where: { id: +reviewId },
      relations: ['reservation.client'],
    });

    if (!review) {
      throw new NotFoundException('No review found');
    }

    const { client } = review.reservation;
    if (role !== 'Client' && client.id !== userId) {
      throw new UnauthorizedException(
        "You don't have permission to update the review",
      );
    }

    if (deleteFiles && deleteFiles.length > 0) {
      await Promise.all(
        deleteFiles.map(
          async (file) => await this.uploadsService.deleteFile({ url: file }),
        ),
      );

      review.photos = review.photos.filter(
        (url: string) => !deleteFiles.includes(url),
      );
    }

    let newPhotoUrls = null;
    if (files && files.length > 0) {
      newPhotoUrls = await Promise.all(
        files.map(async (file) => await this.uploadsService.uploadFile(file)),
      );
    }

    review.photos = [...review.photos, ...newPhotoUrls];

    const updateReviewData = {
      ...review,
      ...updateReviewInput,
    };

    try {
      const updatedReview = await this.reviewsRepository.save(updateReviewData);

      return {
        id: updatedReview.id,
        message: 'Successfully update the review',
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to update the review');
    }
  }

  async delete(jwtUser: JwtUser, params: ParamInput) {
    const { id: userId, role } = jwtUser;
    const { id: reviewId } = params;

    const review = await this.reviewsRepository.findOne({
      where: { id: +reviewId },
      relations: ['reservation.client'],
      select: { id: true, reservation: { id: true, client: { id: true } } },
    });

    if (!review) {
      throw new NotFoundException('No review found');
    }

    const { client } = review.reservation;
    if (role !== 'Client' || client.id !== userId) {
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
}
