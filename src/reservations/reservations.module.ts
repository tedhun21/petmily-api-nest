import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entity/reservation.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReservationsGateWay } from './reservations.gateway';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { KafkaModule } from 'src/kafka/kafka.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // 환경 변수에서 비밀 키 가져오기
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
    NotificationsModule,
    RedisModule,
    KafkaModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsGateWay],
  exports: [ReservationsService],
})
export class ReservationsModule {}
