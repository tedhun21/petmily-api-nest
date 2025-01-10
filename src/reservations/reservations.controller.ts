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
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { ReservationsService } from './reservations.service';
import { UpdateReservationInput } from './dto/update.reservation.dto';
import { ParamInput } from 'src/common/dto/param.dto';
import { FindReservationsInput } from './dto/find.reservation.dto';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @AuthUser() jwtUser: JwtUser,
    @Body() createReservationInput: CreateReservationInput,
  ) {
    return this.reservationsService.create(jwtUser, createReservationInput);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  find(
    @AuthUser() jwtUser: JwtUser,
    @Query() findReservationsInput: FindReservationsInput,
  ) {
    return this.reservationsService.find(jwtUser, findReservationsInput);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@AuthUser() jwtUser: JwtUser, @Param() params: ParamInput) {
    return this.reservationsService.findOne(jwtUser, params);
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Get(':id/review')
  getReservationWithReview(
    @AuthUser() jwtUser: JwtUser,
    @Param() param: ParamInput,
  ) {
    return this.reservationsService.getReservationWithReview(jwtUser, param);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/journal')
  getReservationWithJournal(
    @AuthUser() jwtUser: JwtUser,
    @Param() param: ParamInput,
  ) {
    return this.reservationsService.getReservationWithJournal(jwtUser, param);
  }

  @Get('petsitter/:id')
  findReservationForDay(@Param() param: ParamInput, @Query() query) {
    return this.reservationsService.findByPetsitterForDay(param, query);
  }
}
