import {
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

@Controller('journals')
export class JournalsController {
  constructor(private readonly journalsService: JournalsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  create(
    @AuthUser() jwtUser: JwtUser,
    @Body('data') createJournalInput: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const parsedCreateJournalInput = JSON.parse(createJournalInput);

    return this.journalsService.create(
      jwtUser,
      parsedCreateJournalInput,
      files,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  find(@AuthUser() jwtUser: JwtUser, @Query() paginationDto: PaginationDto) {
    return this.journalsService.find(jwtUser, paginationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@AuthUser() jwtUser: JwtUser, @Param() params: { id: string }) {
    return this.journalsService.findOne(jwtUser, params);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @UseInterceptors(FilesInterceptor('files'))
  update(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { id: string },
    @Body('data') updateJournalInput: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const parsedUpdateJournalInput = JSON.parse(updateJournalInput);
    return this.journalsService.update(
      jwtUser,
      params,
      parsedUpdateJournalInput,
      files,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { id: string | number },
  ) {
    return this.journalsService.delete(jwtUser, params);
  }
}
