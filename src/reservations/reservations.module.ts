import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entity/reservation.entity';
import { ReservationsGateWay } from './reservations.gateway';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { KafkaModule } from 'src/kafka/kafka.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation]),
    NotificationsModule,
    RedisModule,
    KafkaModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsGateWay],
  exports: [ReservationsService],
})
export class ReservationsModule {}
