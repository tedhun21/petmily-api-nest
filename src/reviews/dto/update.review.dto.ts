import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewDto } from './create.review.dto';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateReviewDto extends PartialType(CreateReviewDto) {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deletePhotos?: string[];
}
