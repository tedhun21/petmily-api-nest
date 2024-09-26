import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserInput } from './dto/create.user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Request } from 'express';
import { JwtUser, User } from 'src/auth/decorater/auth.decorator';
import { UpdateUserInput } from './dto/update.user.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}
  @Post()
  create(@Body() createUserInput: CreateUserInput) {
    return this.usersService.create(createUserInput);
  }
  @Get()
  findByEmail(@Query('email') email) {
    return this.usersService.findByEmail(email);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@User() jwtUser: JwtUser) {
    return this.usersService.me(jwtUser);
  }

  @Get(':id')
  findById(@Param() params: { id: string }) {
    return this.usersService.findById(params);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  update(
    @Param() params: { id: string },
    @User() jwtUser: JwtUser,
    @Body() updateUserInput: UpdateUserInput,
  ) {
    return this.usersService.update(params, jwtUser, updateUserInput);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(@Param() params: { id: string }, @User() jwtUser: JwtUser) {
    return this.usersService.delete(params, jwtUser);
  }
}
