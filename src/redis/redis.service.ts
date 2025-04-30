import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { getLocations } from 'src/common/location/location.utils';

@Injectable()
export class RedisService implements OnModuleInit {
  private redisClient: Redis; // 일반 Redis 클라이언트
  private publisherClient: Redis;
  private subscriberClient: Redis; // Pub/Sub 구독용 클라이언트

  constructor() {
    this.redisClient = this.createRedisClient();
    this.publisherClient = this.createRedisClient();
    this.subscriberClient = this.createRedisClient();
  }

  private createRedisClient() {
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

  async onModuleInit() {
    if (!this.redisClient) {
      console.warn('⚠️ Redis 사용 불가: 서버는 계속 실행됩니다.');
      return;
    }

    try {
      await this.redisClient.ping();
      console.log('✅ Redis connected');

      const exists = await this.redisClient.exists('location:count');
      if (!exists) {
        await this.seedLocations();
      }
    } catch (error) {
      console.error('❌ Redis 연결 확인 실패:', error.message);
      this.redisClient = null;
      this.publisherClient = null;
      this.subscriberClient = null;
    }
  }

  getClient(): Redis {
    if (!this.redisClient) {
      throw new Error('REDIS: ❌ Redis client is not initialized.');
    }
    return this.redisClient;
  }

  getPublisherClient(): Redis {
    if (!this.publisherClient) {
      throw new Error('REDIS: ❌ Redis publisher client is not initialized.');
    }
    return this.publisherClient;
  }

  // Pub/Sub - 구독 전용
  getSubscriberClient(): Redis {
    if (!this.subscriberClient) {
      throw new Error('REDIS: ❌ Redis subscriber client is not initialized.');
    }
    return this.subscriberClient;
  }

  async setKey(key: string, value: string): Promise<string> {
    return await this.redisClient.set(key, value);
  }

  async getKey(key: string): Promise<string | null> {
    return await this.redisClient.get(key);
  }

  async subscribe(channel: string, callback: (message: string) => void) {
    const subscriber = this.getSubscriberClient();
    await subscriber.subscribe(channel);
    subscriber.on('message', (ch, message) => {
      if (ch === channel) callback(message);
    });
  }

  async publish(channel: string, message: string) {
    await this.redisClient.publish(channel, message);
  }

  // 서버 시작시에 locations 데이터 등록
  async seedLocations() {
    try {
      console.log('REDIS: 🔄 Saving location data to Redis...');

      const locations = getLocations();
      const pipeline = this.redisClient.pipeline();

      locations.forEach(({ district, latitude, longitude }) => {
        pipeline.zadd('location:count', 0, district); // ZSET에 district만 저장
        pipeline.hset(
          'location:data',
          district,
          JSON.stringify({ latitude, longitude }),
        ); // HASH에 좌표 저장
      });

      await pipeline.exec();
      console.log('REDIS: ✅ Location data successfully saved to Redis!');
    } catch (error) {
      console.error('REDIS: ❌ Failed to save location data to Redis:', error);
    }
  }

  // 특정 지역의  좌표 조회 (index: location:data => HSET)
  async getLocationCoord(key: string) {
    try {
      const data = await this.redisClient.hget('location:data', key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }
  // 특정 지역의 카운트 조회 (index === location:count => ZSET 자료구조)
  async getLocationCount(key: string) {
    const count = await this.redisClient.zscore('location:count', key);
    return count;
  }

  // 상위 count 조회
  async getLocationKey(size: number) {
    try {
      const topDistricts = await this.redisClient.zrevrange(
        'location:count',
        0,
        size - 1,
        'WITHSCORES',
      );

      return topDistricts;
    } catch (e) {}
  }

  // ZINCRBY
  async incrementLocationCount(
    location: string,
    increment = 1,
  ): Promise<number> {
    const result = await this.redisClient.zincrby(
      'location:count', // ZSET 키
      increment, // 증가 시킬 정수
      location, // 위치 (값)
    );

    console.log(`${location}의 count:`, result);
    return parseFloat(result);
  }

  // 유저 알림 unreadCount 카운트 증가 (String)
  async incrementUnreadNotificationCount(
    userId: number,
    increment = 1,
  ): Promise<number> {
    const key = `user:${userId}:unreadNotiCount`;
    const result = await this.redisClient.incrby(key, increment);

    // 만료시간 설정 (1시간)
    const ttl = 3600;
    await this.redisClient.expire(key, ttl);

    return result;
  }

  async decrementUnreadNotificationCount(userId: number, decrement = 1) {
    const key = `user:${userId}:unreadNotiCount`;

    const exists = await this.redisClient.exists(key);
    if (!exists) return;

    await this.redisClient.decrby(key, decrement);

    const currentCount = await this.getUserUnreadNotificationCount(userId);
    if (currentCount < 0) {
      await this.resetUserUnreadNotificationCount(userId); // 또는 this.setUserUnreadNotificationCount(userId, 0);
    }
  }

  // 유저 알림 수 초기화 (모두 읽음 처리)
  async resetUserUnreadNotificationCount(userId: number) {
    const key = `user:${userId}:unreadNotiCount`;
    await this.redisClient.set(key, '0');

    // 만료시간 설정 (1시간)
    const ttl = 3600;
    await this.redisClient.expire(key, ttl);
  }

  // 현재 안 읽은 알림 수 조회
  async getUserUnreadNotificationCount(userId: number): Promise<number> {
    const key = `user:${userId}:unreadNotiCount`;
    const result = await this.redisClient.get(key);
    return result ? parseInt(result) : 0;
  }

  //
  async setUserUnreadNotificationCount(userId: number, count: number) {
    const key = `user:${userId}:unreadNotiCount`;

    const ttl = 3600;
    await this.redisClient.set(key, count.toString(), 'EX', ttl); // 'EX' 초단위
  }

  // // 유저가 속한 모든 채팅방의 undreadCount 가져오기 (zset(sorted set) 구조로 count 값이 있는 것만 가져오기)
  // async getUserAllUnreadCounts(userId: number) {
  //   const key = `user:${userId}:unreadRooms`;

  //   // zrangebyscore로 unreadCount가 있는 채팅방만 가져오기 (score > 0)
  //   const unreadChatRooms = await this.redisClient.zrangebyscore(
  //     key,
  //     1,
  //     '+inf',
  //   );
  //   return unreadChatRooms;
  // }

  // // 유저의 채팅방에 대한 unreadCount 증가
  // async incrementUserUnreadCount(
  //   userId: number,
  //   chatRoomId: string,
  //   count: number = 1,
  // ) {
  //   const key = `user:${userId}:unreadRooms`;

  //   await this.redisClient.zincrby(key, count, chatRoomId);
  // }

  // // 유저의 채팅방에서 unreadCount 삭제
  // async deleteUserUnreadCount(userId: string, chatRoomId: string) {
  //   const key = `user:${userId}:chatRoom:${chatRoomId}:unreadCount`;

  //   // 해당 유저의 unreadCount 키 삭제
  //   await this.redisClient.del(key);
  // }
}
