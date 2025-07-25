import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit {
  private redisClient: Redis | null = null; // 일반 Redis 클라이언트
  private publisherClient: Redis;
  private subscriberClient: Redis; // Pub/Sub 구독용 클라이언트
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {}

  //  재연결 전략 (최대 3번 재시도)
  private retryStrategy(times: number): number | null {
    if (times >= 2) {
      this.logger.error('❌ Redis 연결 실패: 최대 재시도 횟수 초과');
      return null; // 재시도 중단
    }
    const delay = Math.min(times * 500, 2000); // 0.5초, 1초, 최대 2초 대기 후 재시도
    this.logger.warn(`⚠️ Redis 재연결 시도 중... (${times}/3)`);
    return delay;
  }

  private createRedisClient(): Redis {
    const client = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
      db: 0,
      retryStrategy: this.retryStrategy.bind(this), // Bind 'this' to the instance method
    });

    client.on('error', (err) => {
      this.logger.error('Redis Client Error:', err);
    });

    return client;
  }

  async onModuleInit() {
    try {
      const client = this.createRedisClient();
      await client.ping(); // 연결 확인
      this.redisClient = client;

      this.publisherClient = this.createRedisClient();
      this.subscriberClient = this.createRedisClient();

      this.logger.log('✅ Redis connected');
    } catch (error) {
      this.logger.error('❌ Redis 연결 확인 실패:', error.message);
      this.redisClient = null;
      this.publisherClient = null;
      this.subscriberClient = null;
    }
  }

  getClient(): Redis | null {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      this.logger.warn(
        '⚠️ Redis client is not ready. Proceeding without Redis.',
        RedisService.name,
      );
      return null;
    }
    return this.redisClient;
  }

  getPublisherClient(): Redis | null {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      this.logger.warn(
        '⚠️ Redis publisher is not ready. Proceeding without Redis.',
        RedisService.name,
      );
      return null;
    }
    return this.publisherClient;
  }

  // Pub/Sub - 구독 전용
  getSubscriberClient(): Redis | null {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      this.logger.warn(
        '⚠️ Redis subscriber is not ready. Proceeding without Redis.',
        RedisService.name,
      );
      return null;
    }
    return this.subscriberClient;
  }

  getClientOrThrow(): Redis {
    const client = this.getClient();
    if (!client) {
      throw new Error('❗ Redis client is not available');
    }
    return client;
  }
}
