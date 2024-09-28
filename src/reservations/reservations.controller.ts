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
import { CreateReservationInput } from './dto/create-reservation.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { ReservationsService } from './reservations.service';
import { UpdateReservationInput } from './dto/update-reservation.dto';
import { PaginationInput } from 'src/common/dto/pagination.dto';

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
  find(@AuthUser() jwtUser: JwtUser, @Query() pagination: PaginationInput) {
    return this.reservationsService.find(jwtUser, pagination);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@AuthUser() jwtUser: JwtUser, @Param() params: { id: string }) {
    return this.reservationsService.findOne(jwtUser, params);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  update(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { id: string },
    @Body() updateReservationInput: UpdateReservationInput,
  ) {
    return this.reservationsService.update(
      jwtUser,
      params,
      updateReservationInput,
    );
  }
}
