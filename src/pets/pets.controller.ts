import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CreatePetDto } from './dto/create.pet.dto';
import { PetsService } from './pets.service';

import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ParamDto } from 'src/common/dto/param.dto';
import { UpdatePetDto } from './dto/update.pet.dto';

@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @AuthUser() jwtUser: JwtUser,
    @Body('data') createPetDto: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const dto = plainToInstance(CreatePetDto, JSON.parse(createPetDto));

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

    return this.petsService.create(jwtUser, dto, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  find(@AuthUser() jwtUser: JwtUser, @Query() paginationDto: PaginationDto) {
    return this.petsService.find(jwtUser.id, paginationDto);
  }

  @Get(':id')
  findOne(@Param() paramDto: ParamDto) {
    return this.petsService.findOne(paramDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @AuthUser() jwtUser: JwtUser,
    @Param() paramDto: ParamDto,
    @Body('data') updatePetDto: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const dto = plainToInstance(UpdatePetDto, JSON.parse(updatePetDto));

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

    return this.petsService.update(jwtUser, paramDto, dto, file);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@AuthUser() jwtUser: JwtUser, @Param() paramDto: ParamDto) {
    return this.petsService.delete(jwtUser, paramDto);
  }
}
