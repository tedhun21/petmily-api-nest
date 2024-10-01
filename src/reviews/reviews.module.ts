import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entity/reivew.entity';
import { ReservationsModule } from 'src/reservations/reservations.module';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review]),
    ReservationsModule,
    UploadsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}