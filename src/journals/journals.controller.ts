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
import { AuthGuard } from 'src/auth/auth.guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JournalsService } from './journals.service';
import { PaginationInput } from 'src/common/dto/pagination.dto';

@Controller('journals')
export class JournalsController {
  constructor(private readonly journalsService: JournalsService) {}

  @UseGuards(AuthGuard)
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

  @UseGuards(AuthGuard)
  @Get()
  find(@AuthUser() jwtUser: JwtUser, @Query() pagination: PaginationInput) {
    return this.journalsService.find(jwtUser, pagination);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@AuthUser() jwtUser: JwtUser, @Param() params: { id: string }) {
    return this.journalsService.findOne(jwtUser, params);
  }

  @UseGuards(AuthGuard)
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

  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { id: string | number },
  ) {
    return this.journalsService.delete(jwtUser, params);
  }
}
