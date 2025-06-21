import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RedisChatService } from './chat/redis-chat.service';
import { RedisNotificationService } from './notification/redis-notification.service';
import { RedisLocationService } from './location/redis-location.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'SEARCH_SERVICE',
        transport: Transport.REDIS,
        options: { host: 'localhost', port: 6379 },
      },
    ]),
  ],
  providers: [
    RedisService,
    RedisLocationService,
    RedisChatService,
    RedisNotificationService,
  ],
  exports: [
    RedisService,
    RedisLocationService,
    RedisChatService,
    RedisNotificationService,
  ],
})
export class RedisModule {}
