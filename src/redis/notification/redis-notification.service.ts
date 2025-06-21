import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';

@Injectable()
export class RedisNotificationService {
  private readonly TTL_SECONDS = 60 * 60; // 1시간

  constructor(private readonly redisService: RedisService) {}

  // 유저 알림 unreadCount 카운트 증가 (String)
  async incrementUnreadNotificationCount(
    userId: number,
    increment = 1,
  ): Promise<number> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const key = `user:${userId}:unreadNotiCount`;
    const result = await redisClient.incrby(key, increment);

    // 만료시간 설정 (1시간)
    await redisClient.expire(key, this.TTL_SECONDS);

    return result;
  }

  // 현재 안 읽은 알림 수 조회
  async getUserUnreadNotificationCount(userId: number): Promise<number> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const key = `user:${userId}:unread_noti_count`;
    const result = await redisClient.get(key);
    return result ? parseInt(result) : 0;
  }

  async setUserUnreadNotificationCount(userId: number, count: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const key = `user:${userId}:unreadNotiCount`;

    await redisClient.set(key, count.toString(), 'EX', this.TTL_SECONDS); // 'EX' 초단위
  }

  async decrementUnreadNotificationCount(userId: number, decrement = 1) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const key = `user:${userId}:unreadNotiCount`;

    const exists = await redisClient.exists(key);
    if (!exists) return;

    await redisClient.decrby(key, decrement);

    const currentCount = await this.getUserUnreadNotificationCount(userId);
    if (currentCount < 0) {
      await this.resetUserUnreadNotificationCount(userId);
    }
  }

  // 유저 알림 수 초기화 (모두 읽음 처리)
  async resetUserUnreadNotificationCount(userId: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const key = `user:${userId}:unreadNotiCount`;
    await redisClient.set(key, '0');

    await redisClient.expire(key, this.TTL_SECONDS);
  }
}
