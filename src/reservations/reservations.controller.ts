import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateReservationInput } from './dto/create.reservation.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { ReservationsService } from './reservations.service';
import { UpdateReservationInput } from './dto/update.reservation.dto';
import { ParamInput } from 'src/common/dto/param.dto';
import { FindReservationsInput } from './dto/find.reservation.dto';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}
  @UseGuards(AuthGuard)
  @Post()
  create(
    @AuthUser() jwtUser: JwtUser,
    @Body() createReservationInput: CreateReservationInput,
  ) {
    return this.reservationsService.create(jwtUser, createReservationInput);
  }

  @UseGuards(AuthGuard)
  @Get()
  find(
    @AuthUser() jwtUser: JwtUser,
    @Query() findReservationsInput: FindReservationsInput,
  ) {
    return this.reservationsService.find(jwtUser, findReservationsInput);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@AuthUser() jwtUser: JwtUser, @Param() params: ParamInput) {
    return this.reservationsService.findOne(jwtUser, params);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  update(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: ParamInput,
    @Body() updateReservationInput: UpdateReservationInput,
  ) {
    return this.reservationsService.update(
      jwtUser,
      params,
      updateReservationInput,
    );
  }
}
