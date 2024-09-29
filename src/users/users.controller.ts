import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserInput } from './dto/create.user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { UpdateUserInput } from './dto/update.user.dto';
import { ParamInput } from 'src/common/dto/param.dto';
import { PaginationInput } from 'src/common/dto/pagination.dto';
import { FindPossiblePetsittersInput } from './dto/findPossible.petsitter.dto';
import { FindReservationsInput } from 'src/reservations/dto/find.reservation.dto';
import { Status } from 'src/reservations/entity/reservation.entity';

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

  @UseGuards(AuthGuard)
  @Get('me')
  me(@AuthUser() jwtUser: JwtUser) {
    return this.usersService.me(jwtUser);
  }

  @Get(':id')
  findById(@Param() params: ParamInput) {
    return this.usersService.findById(params);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  update(
    @Param() params: ParamInput,
    @AuthUser() jwtUser: JwtUser,
    @Body() updateUserInput: UpdateUserInput,
  ) {
    return this.usersService.update(params, jwtUser, updateUserInput);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(@Param() params: ParamInput, @AuthUser() jwtUser: JwtUser) {
    return this.usersService.delete(params, jwtUser);
  }

  @UseGuards(AuthGuard)
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

  @UseGuards(AuthGuard)
  @Get('petsitters/used')
  findUsedPetsitters(
    @AuthUser() jwtUser: JwtUser,
    @Query() pagination: PaginationInput,
  ) {
    return this.usersService.findUsedPetsitters(jwtUser, pagination);
  }
}
