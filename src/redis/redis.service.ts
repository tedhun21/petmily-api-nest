import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit {
  private redisClient: Redis | null = null; // 일반 Redis 클라이언트
  private publisherClient: Redis;
  private subscriberClient: Redis; // Pub/Sub 구독용 클라이언트

  //  재연결 전략 (최대 3번 재시도)
  private static retryStrategy(times: number): number | null {
    if (times >= 2) {
      console.error('❌ Redis 연결 실패: 최대 재시도 횟수 초과');
      return null; // 재시도 중단
    }
    const delay = Math.min(times * 500, 2000); // 0.5초, 1초, 최대 2초 대기 후 재시도
    console.warn(`⚠️ Redis 재연결 시도 중... (${times}/3)`);
    return delay;
  }

  private createRedisClient(): Redis {
    const client = new Redis({
      host: 'localhost',
      port: 6379,
      db: 0,
      retryStrategy: RedisService.retryStrategy,
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
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

      console.log('✅ Redis connected');
    } catch (error) {
      console.error('❌ Redis 연결 확인 실패:', error.message);
      this.redisClient = null;
      this.publisherClient = null;
      this.subscriberClient = null;
    }
  }

  getClient(): Redis | null {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      console.warn('⚠️ Redis client is not ready. Proceeding without Redis.');
      return null;
    }
    return this.redisClient;
  }

  getPublisherClient(): Redis | null {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      console.warn(
        '⚠️ Redis publisher is not ready. Proceeding without Redis.',
      );
      return null;
    }
    return this.publisherClient;
  }

  // Pub/Sub - 구독 전용
  getSubscriberClient(): Redis | null {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      console.warn(
        '⚠️ Redis subscriber is not ready. Proceeding without Redis.',
      );
      return null;
    }
    return this.subscriberClient;
  }
}
