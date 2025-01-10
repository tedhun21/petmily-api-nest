import { PickType } from '@nestjs/mapped-types';
import { Review } from '../entity/review.entity';

export class CreateReviewInput extends PickType(Review, ['body', 'star']) {
  reservationId: number;
}
