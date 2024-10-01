import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { ReservationsModule } from 'src/reservations/reservations.module';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ReservationsModule,
    UploadsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
