import { PartialType } from '@nestjs/mapped-types';
import { Review } from '../entity/review.entity';

export class UpdateReviewInput extends PartialType(Review) {
  deleteFiles: string[];
}
