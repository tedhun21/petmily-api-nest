import { Controller } from '@nestjs/common';

import {
  Body,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { PaginationInput } from 'src/common/dto/pagination.dto';
import { CreateReviewInput } from './dto/create.review.dto';
import { ReviewsService } from './reviews.service';
import { ParamInput } from 'src/common/dto/param.dto';
import { UpdateReviewInput } from './dto/update.review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}
  @UseGuards(AuthGuard)
  @Post()
  create(
    @AuthUser() jwtUser: JwtUser,
    @Body() createReviewInput: CreateReviewInput,
  ) {
    return this.reviewsService.create(jwtUser, createReviewInput);
  }

  @Get()
  find(@Query() pagination: PaginationInput) {
    return this.reviewsService.find(pagination);
  }

  @Get(':id')
  findOne(@Param() params: ParamInput) {
    return this.reviewsService.findOne(params);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  update(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: ParamInput,
    @Body() updateReviewInput: UpdateReviewInput,
  ) {
    return this.reviewsService.update(jwtUser, params, updateReviewInput);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(@AuthUser() jwtUser: JwtUser, @Param() params: ParamInput) {
    return this.reviewsService.delete(jwtUser, params);
  }
}
