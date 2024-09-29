import { PartialType } from '@nestjs/mapped-types';
import { Review } from '../entity/reivew.entity';

export class UpdateReviewInput extends PartialType(Review) {}
