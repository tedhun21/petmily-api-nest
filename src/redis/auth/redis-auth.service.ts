import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';

@Injectable()
export class RedisAuthService {
  private readonly TTL_SECONDS = 60 * 60 * 24 * 7; // 7일

  constructor(private readonly redisService: RedisService) {}

  // Key - Value 구조

  async saveRefreshToken(userId: number, token: string) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;
    const key = `refreshToken:${userId}`;

    await redisClient.set(key, token, 'EX', this.TTL_SECONDS);
  }

  async getRefreshToken(userId: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;
    const key = `refreshToken:${userId}`;

    return await redisClient.get(key);
  }

  async deleteRefreshToken(userId: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const key = `refreshToken:${userId}`;
    await redisClient.del(key);
  }
}
