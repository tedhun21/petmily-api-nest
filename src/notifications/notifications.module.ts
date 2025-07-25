import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { RedisModule } from 'src/redis/redis.module';
import { Notification } from './entity/notification.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationRead } from './entity/notification_read.entity';
import { NotificationsController } from './notifications.controller';
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationRead]),
    RedisModule,
    KafkaModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
