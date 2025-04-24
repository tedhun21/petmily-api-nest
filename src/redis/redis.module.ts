import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
