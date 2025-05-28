import {
  BadRequestException,
  Controller,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

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
import { ParamDto } from 'src/common/dto/param.dto';
import { FindReviewsDto } from './dto/find.review.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateReviewDto } from './dto/create.review.dto';
import { UpdateReviewDto } from './dto/update.review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files'))
  @Post()
  async create(
    @AuthUser() jwtUser: JwtUser,
    @Body('data') createReviewDto: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const dto = plainToInstance(CreateReviewDto, createReviewDto);
    const errors = await validate(dto);

    if (errors.length > 0) {
      const formattedErrors = errors.map((err) => ({
        property: err.property,
        constraints: err.constraints,
      }));
      throw new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }
    return this.reviewsService.create(jwtUser, dto, files);
  }

  @Get()
  find(@Query() findReviewsDto: FindReviewsDto) {
    return this.reviewsService.find(findReviewsDto);
  }

  @Get(':id')
  findOne(@Param() params: ParamDto) {
    return this.reviewsService.findOne(params);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files'))
  @Put(':id')
  async update(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: ParamDto,
    @Body('data') updateReviewDto: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const dto = plainToInstance(UpdateReviewDto, updateReviewDto);
    const errors = await validate(dto);

    if (errors.length > 0) {
      const formattedErrors = errors.map((err) => ({
        property: err.property,
        constraints: err.constraints,
      }));
      throw new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    return this.reviewsService.update(jwtUser, params, dto, files);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@AuthUser() jwtUser: JwtUser, @Param() params: ParamDto) {
    return this.reviewsService.delete(jwtUser, params);
  }

  @Get('petsitter/:nickname')
  findByPetsitter(@Param() params, @Query() query) {
    return this.reviewsService.findByPetsitter(params, query);
  }
}
