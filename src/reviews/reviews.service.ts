import {
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
import { Repository } from 'typeorm';
import { ReservationsService } from 'src/reservations/reservations.service';
import { ParamInput } from 'src/common/dto/param.dto';
import { UpdateReviewInput } from './dto/update.review.dto';
import { PaginationInput } from 'src/common/dto/pagination.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    private readonly reservationsService: ReservationsService,
  ) {}
  async create(jwtUser: JwtUser, createReviewInput: CreateReviewInput) {
    const { id: userId, role } = jwtUser;
    const { reservationId } = createReviewInput;

    const reservation = await this.reservationsService.findOne(jwtUser, {
      id: reservationId,
    });

    if (!reservation) {
      throw new NotFoundException('No reservation found');
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

    const review = this.reviewsRepository.create({
      ...createReviewInput,
      reservation: { id: reservationId },
    });

    try {
      const newReview = await this.reviewsRepository.save(review);

      return { id: newReview.id, message: 'Successfully create a review' };
    } catch (e) {
      throw new InternalServerErrorException('Fail to create a review');
    }
  }

  async find(pagination: PaginationInput) {
    const { page, pageSize } = pagination;

    try {
      const [reviews, total] = await this.reviewsRepository.findAndCount({
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
  ) {
    const { id: userId, role } = jwtUser;
    const { id: reviewId } = params;

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
    } catch (e) {}

    console.log(review);
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
