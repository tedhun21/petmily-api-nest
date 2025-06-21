import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { getLocations } from 'src/common/location/location.utils';

@Injectable()
export class RedisLocationService {
  constructor(private readonly redisService: RedisService) {}

  // 서버 시작시에 locations 데이터 등록
  async seedLocations() {
    try {
      console.log('REDIS: 🔄 Saving location data to Redis...');
      const redisClient = this.redisService.getClient();

      const locations = getLocations();
      const pipeline = redisClient.pipeline();

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
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const data = await redisClient.hget('location:data', key);
    return data ? JSON.parse(data) : null;
  }

  // 특정 지역의 카운트 조회 (index === location:count => ZSET 자료구조)
  async getLocationCount(key: string) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const count = await redisClient.zscore('location:count', key);
    return count;
  }

  // 상위 count 조회
  async getLocationKey(size: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const topDistricts = await redisClient.zrevrange(
      'location:count',
      0,
      size - 1,
      'WITHSCORES',
    );

    return topDistricts;
  }

  // ZINCRBY
  async incrementLocationCount(
    location: string,
    increment = 1,
  ): Promise<number> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const result = await redisClient.zincrby(
      'location:count', // ZSET 키
      increment, // 증가 시킬 정수
      location, // 위치 (값)
    );

    return parseFloat(result);
  }
}
