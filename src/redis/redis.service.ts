import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Redis from 'ioredis';
import { getLocations } from 'src/common/location/location.utils';

@Injectable()
export class RedisService implements OnModuleInit {
  private redisClient: Redis.Redis;

  constructor() {
    // Redis 클라이언트 초기화
    this.redisClient = new Redis.default({
      host: 'localhost', // Redis 서버 주소
      port: 6379, // Redis 서버 포트
      db: 0, // 사용하는 데이터베이스 인덱스,

      // ❗ 3초 동안만 재시도 후 포기
      retryStrategy(times) {
        if (times >= 3) {
          console.error('❌ Giving up on Redis reconnect.');
          return undefined; // 기본 재시도 로직 사용
        }
        console.warn(`⚠️ Attempting Redis reconnect... (${times}/3)`);
        return 1000; // 1초 후 재시도
      },
    });
  }

  async onModuleInit() {
    try {
      // Redis 서버가 연결되었는지 확인
      await this.redisClient.ping();
      console.log('REDIS: ✅ Redis is connected');

      const exists = await this.redisClient.exists('location:count');

      if (exists) {
        console.log(`REDIS: ℹ️ "${'location:count'}" already exists`);
      } else if (!exists) {
        await this.seedLocations();
      }
    } catch (error) {
      console.error('REDIS: ❌ Redis connection failed:', error);
      this.redisClient = null; // Redis 클라이언트 null 처리
    }
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

  getClient(): Redis.Redis {
    if (!this.redisClient) {
      throw new Error('REDIS: ❌ Redis client is not initialized.');
    }
    return this.redisClient;
  }

  // 데이터를 Redis에 저장
  async setKey(key: string, value: string): Promise<string> {
    return await this.redisClient.set(key, value);
  }

  async getKey(key: string): Promise<string | null> {
    return await this.redisClient.get(key);
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

  // 유저가 속한 모든 채팅방의 undreadCount 가져오기 (zset(sorted set) 구조로 count 값이 있는 것만 가져오기)
  async getUserAllUnreadCounts(userId: number) {
    const key = `user:${userId}:unreadRooms`;

    // zrangebyscore로 unreadCount가 있는 채팅방만 가져오기 (score > 0)
    const unreadChatRooms = await this.redisClient.zrangebyscore(
      key,
      1,
      '+inf',
    );
    return unreadChatRooms;
  }

  // 유저의 채팅방에 대한 unreadCount 증가
  async incrementUserUnreadCount(
    userId: number,
    chatRoomId: string,
    count: number = 1,
  ) {
    const key = `user:${userId}:unreadRooms`;

    await this.redisClient.zincrby(key, count, chatRoomId);
  }

  // 유저의 채팅방에서 unreadCount 삭제
  async deleteUserUnreadCount(userId: string, chatRoomId: string) {
    const key = `user:${userId}:chatRoom:${chatRoomId}:unreadCount`;

    // 해당 유저의 unreadCount 키 삭제
    await this.redisClient.del(key);
  }
}
