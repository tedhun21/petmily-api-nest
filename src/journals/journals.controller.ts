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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JournalsService } from './journals.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ParamDto } from 'src/common/dto/param.dto';
import { plainToInstance } from 'class-transformer';
import { CreateJournalDto } from './dto/create.journal.dto';
import { validate } from 'class-validator';
import { UpdateJournalDto } from './dto/update.journal.dto';

@Controller('journals')
export class JournalsController {
  constructor(private readonly journalsService: JournalsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  async create(
    @AuthUser() jwtUser: JwtUser,
    @Body('data') createJournalDto: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const dto = plainToInstance(CreateJournalDto, createJournalDto);

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

    return this.journalsService.create(jwtUser, dto, files);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  find(@AuthUser() jwtUser: JwtUser, @Query() paginationDto: PaginationDto) {
    return this.journalsService.find(jwtUser, paginationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@AuthUser() jwtUser: JwtUser, @Param() paramDto: ParamDto) {
    return this.journalsService.findOne(jwtUser, paramDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @UseInterceptors(FilesInterceptor('files'))
  async update(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { id: string },
    @Body('data') updateJournalDto: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const dto = plainToInstance(UpdateJournalDto, updateJournalDto);

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

    return this.journalsService.update(jwtUser, params, dto, files);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@AuthUser() jwtUser: JwtUser, @Param() paramDto: ParamDto) {
    return this.journalsService.delete(jwtUser, paramDto);
  }
}
