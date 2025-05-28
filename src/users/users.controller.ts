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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create.user.dto';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { UpdateUserDto } from './dto/update.user.dto';
import { ParamDto } from 'src/common/dto/param.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { FindPossiblePetsittersDto } from './dto/find.petsitterPossible.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateFavoriteDto } from './dto/updateFavorite.user';
import { FindUserByEmailOrNicknameDto } from './dto/find.petsitterByNickname.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findByEmailOrNickname(@Query() query: FindUserByEmailOrNicknameDto) {
    return this.usersService.findByEmailOrNickname(query);
  }

  @Get('by-ids')
  findByIds(@Query('ids') ids: string) {
    const arrayIds = ids.split(',').map((id) => Number(id));

    return this.usersService.findByIds(arrayIds);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@AuthUser() jwtUser: JwtUser) {
    return this.usersService.me(jwtUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/favorites')
  getFavorites(@AuthUser() jwtUser: JwtUser) {
    return this.usersService.getFavorites(jwtUser);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/favorites')
  updateFavorite(
    @AuthUser() jwtUser: JwtUser,
    @Body() updateFavoriteDto: UpdateFavoriteDto,
  ) {
    return this.usersService.updateFavorite(jwtUser, updateFavoriteDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param() paramDto: ParamDto,
    @AuthUser() jwtUser: JwtUser,
    @Body('data') updateUserDto: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const dto = plainToInstance(UpdateUserDto, JSON.parse(updateUserDto));
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

    return this.usersService.update(paramDto, jwtUser, dto, file);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Param() params: ParamDto, @AuthUser() jwtUser: JwtUser) {
    return this.usersService.delete(params, jwtUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get('petsitters/favorite')
  findFavoritePetsitters(
    @AuthUser() jwtUser: JwtUser,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.usersService.findFavoritePetsitters(jwtUser, paginationDto);
  }

  @Get('petsitters/possible')
  findPossiblePetsitters(
    @Query() findPossiblePetsittersDto: FindPossiblePetsittersDto,
  ) {
    return this.usersService.findPossiblePetsitters(findPossiblePetsittersDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('petsitters/used')
  findUsedPetsitters(
    @AuthUser() jwtUser: JwtUser,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.usersService.findUsedPetsitters(jwtUser, paginationDto);
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
