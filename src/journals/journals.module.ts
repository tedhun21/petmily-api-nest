import { Module } from '@nestjs/common';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Journal } from './entity/journal.entity';
import { ReservationsModule } from 'src/reservations/reservations.module';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Journal]),
    ReservationsModule,
    UploadsModule,
  ],
  controllers: [JournalsController],
  providers: [JournalsService],
})
export class JournalsModule {}
