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
import { UsersService } from './users.service';
import { CreateUserInput } from './dto/create.user.dto';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { UpdateUserInput } from './dto/update.user.dto';
import { ParamInput } from 'src/common/dto/param.dto';
import { PaginationInput } from 'src/common/dto/pagination.dto';
import { FindPossiblePetsittersInput } from './dto/findPossible.petsitter.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Post()
  create(@Body() createUserInput: CreateUserInput) {
    return this.usersService.create(createUserInput);
  }
  @Get()
  findByEmail(@Query('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@AuthUser() jwtUser: JwtUser) {
    return this.usersService.me(jwtUser);
  }

  @Get(':id')
  findById(@Param() params: ParamInput) {
    return this.usersService.findById(params);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @UseInterceptors(FileInterceptor('file'))
  update(
    @Param() params: ParamInput,
    @AuthUser() jwtUser: JwtUser,
    @Body('data') updateUserInput: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const parsedUpdateUserInput: UpdateUserInput = JSON.parse(updateUserInput);
    return this.usersService.update(
      params,
      jwtUser,
      parsedUpdateUserInput,
      file,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Param() params: ParamInput, @AuthUser() jwtUser: JwtUser) {
    return this.usersService.delete(params, jwtUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get('petsitters/favorite')
  findFavoritePetsitters(
    @AuthUser() jwtUser: JwtUser,
    @Query() pagination: PaginationInput,
  ) {
    return this.usersService.findFavoritePetsitters(jwtUser, pagination);
  }

  @Get('petsitters/possible')
  findPossiblePetsitters(
    @Query() findPossiblePetsittersIput: FindPossiblePetsittersInput,
  ) {
    return this.usersService.findPossiblePetsitters(findPossiblePetsittersIput);
  }

  @UseGuards(JwtAuthGuard)
  @Get('petsitters/used')
  findUsedPetsitters(
    @AuthUser() jwtUser: JwtUser,
    @Query() pagination: PaginationInput,
  ) {
    return this.usersService.findUsedPetsitters(jwtUser, pagination);
  }

  @Get('petsitters/star')
  findStarPetsitters() {
    console.log('star');
  }

  @Get('petsitters/review')
  findReviewPetsitters() {
    console.log('review');
  }

  @Get('petsitters/new')
  findNewPetsitters() {
    console.log('new');
  }
}
