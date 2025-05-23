import { Controller, UploadedFiles, UseInterceptors } from '@nestjs/common';

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
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { ReviewsService } from './reviews.service';
import { ParamInput } from 'src/common/dto/param.dto';
import { FindReviewsInput } from './dto/find.review.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files'))
  @Post()
  create(
    @AuthUser() jwtUser: JwtUser,
    @Body('data') createReviewInput: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const parsedCreateReviewInput = JSON.parse(createReviewInput);
    return this.reviewsService.create(jwtUser, parsedCreateReviewInput, files);
  }

  @Get()
  find(@Query() findReviewsInput: FindReviewsInput) {
    return this.reviewsService.find(findReviewsInput);
  }

  @Get(':id')
  findOne(@Param() params: ParamInput) {
    return this.reviewsService.findOne(params);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files'))
  @Put(':id')
  update(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: ParamInput,
    @Body('data') updateReviewInput: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const parsedUpdateReviewInput = JSON.parse(updateReviewInput);
    return this.reviewsService.update(
      jwtUser,
      params,
      parsedUpdateReviewInput,
      files,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@AuthUser() jwtUser: JwtUser, @Param() params: ParamInput) {
    return this.reviewsService.delete(jwtUser, params);
  }

  @Get('petsitter/:nickname')
  findByPetsitter(@Param() params, @Query() query) {
    return this.reviewsService.findByPetsitter(params, query);
  }
}
