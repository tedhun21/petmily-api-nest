import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RedisChatService } from './chat/redis-chat.service';
import { RedisNotificationService } from './notification/redis-notification.service';
import { RedisLocationService } from './location/redis-location.service';
import { RedisAuthService } from './auth/redis-auth.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
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
    RedisAuthService,
  ],
  exports: [
    RedisService,
    RedisLocationService,
    RedisChatService,
    RedisNotificationService,
    RedisAuthService,
  ],
})
export class RedisModule {}
