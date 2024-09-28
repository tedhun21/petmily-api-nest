import {
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
import { CreatePetInput } from './dto/create.pet.dto';
import { PetsService } from './pets.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaginationInput } from 'src/common/dto/pagination.dto';

@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}
  @UseGuards(AuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(
    @AuthUser() jwtUser: JwtUser,
    @Body('data') createPetInput: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const parsedCreatePetInput: CreatePetInput = JSON.parse(createPetInput);
    return this.petsService.create(jwtUser, parsedCreatePetInput, file);
  }

  @Get()
  find(@Query() pagination: PaginationInput) {
    return this.petsService.find(pagination);
  }

  @Get(':id')
  findOne(@Param() params: { id: string }) {
    return this.petsService.findOne(params);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  @UseInterceptors(FileInterceptor('file'))
  update(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { id: string },
    @Body('data') updatePetInput: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const parsedUpdatePetInput = JSON.parse(updatePetInput);
    return this.petsService.update(jwtUser, params, parsedUpdatePetInput, file);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(@AuthUser() jwtUser: JwtUser, @Param() params: { id: string }) {
    return this.petsService.delete(jwtUser, params);
  }
}
