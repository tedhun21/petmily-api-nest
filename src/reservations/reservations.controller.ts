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
import { CreateReservationDto } from './dto/create.reservation.dto';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { ReservationsService } from './reservations.service';
import { UpdateReservationDto } from './dto/update.reservation.dto';
import { ParamDto } from 'src/common/dto/param.dto';
import { FindReservationsDto } from './dto/find.reservation.dto';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @AuthUser() jwtUser: JwtUser,
    @Body() createReservationDto: CreateReservationDto,
  ) {
    return this.reservationsService.create(jwtUser, createReservationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  find(
    @AuthUser() jwtUser: JwtUser,
    @Query() findReservationsDto: FindReservationsDto,
  ) {
    return this.reservationsService.find(jwtUser, findReservationsDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('month')
  findMonthWithReservation(@AuthUser() jwtUser: JwtUser) {
    return this.reservationsService.findMonthWithReservation(jwtUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@AuthUser() jwtUser: JwtUser, @Param() params: ParamDto) {
    return this.reservationsService.findOne(jwtUser, params);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: ParamDto,
    @Body() updateReservationDto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(
      jwtUser,
      params,
      updateReservationDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/review')
  getReservationWithReview(
    @AuthUser() jwtUser: JwtUser,
    @Param() param: ParamDto,
  ) {
    return this.reservationsService.getReservationWithReview(jwtUser, param);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/journal')
  getReservationWithJournal(
    @AuthUser() jwtUser: JwtUser,
    @Param() param: ParamDto,
  ) {
    return this.reservationsService.getReservationWithJournal(jwtUser, param);
  }
}
