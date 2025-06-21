import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';

@Injectable()
export class RedisChatService {
  private readonly TTL_SECONDS = 60 * 30; // 30분

  constructor(private readonly redisService: RedisService) {}

  // Redis Key: unread_message_count:{userId}
  // Redis Hash Field: {chatRoomId}
  // Redis Hash Value:unreadCount (type string)

  async incremetOrInitUnreadCount(
    userId: number,
    chatRoomId: number,
    initialValue: number = 1,
  ) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const hashKey = `unread_message_count:${userId}`;
    const field = chatRoomId.toString();

    const exists = await this.hasUnreadCount(userId, chatRoomId);

    if (exists) {
      await redisClient.hincrby(hashKey, field, 1);
    } else {
      await redisClient.hset(hashKey, field, initialValue.toString());
    }

    await redisClient.expire(hashKey, this.TTL_SECONDS);
  }

  async setUnreadCount(userId: number, chatRoomId: number, count: number) {
    const redisClient = this.redisService.getClient();

    if (!redisClient) return;
    if (count === 0) {
      await this.clearUnreadCount(userId, chatRoomId);
      return;
    }

    const hashKey = `unread_message_count:${userId}`;
    const field = chatRoomId.toString();

    await redisClient.hset(hashKey, field, count.toString());

    await redisClient.expire(hashKey, this.TTL_SECONDS);
  }

  // 특정 채팅방의 유저의 안 읽은 카운트 조회
  async getUnreadCount(userId: number, chatRoomId: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const hashKey = `unread_message_count:${userId}`;
    const field = chatRoomId.toString();

    const count = await redisClient.hget(hashKey, field);
    return count ? parseInt(count) : 0;
  }

  // 사용자의 모든 채팅방 안 읽은 카운트 조회
  async getAllUnreadCounts(userId: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return {};

    const hashKey = `unread_message_count:${userId}`;
    const counts = await redisClient.hgetall(hashKey);

    const result = {};
    for (const [chatRoomId, count] of Object.entries(counts || {})) {
      const parsed = Number(count);
      result[chatRoomId] = Number.isNaN(parsed) ? 0 : parsed;
    }

    console.log('result', result);

    return result;
  }

  // 사용자의 총 안 읽은 메시지 수 계산
  async getTotalUnreadCount(userId: number): Promise<number> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const counts = await this.getAllUnreadCounts(userId);
    return (Object.values(counts) as number[]).reduce(
      (total, count) => total + count,
      0,
    );
  }

  // unreadCount 캐시 삭제
  async clearUnreadCount(userId: number, chatRoomId: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const hashKey = `unread_message_count:${userId}`;
    const field = chatRoomId.toString();

    await redisClient.hdel(hashKey, field);
  }

  // 해당 필드가 존재하는지
  async hasUnreadCount(userId: number, chatRoomId: number): Promise<boolean> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const hashKey = `unread_message_count:${userId}`;
    const field = chatRoomId.toString();

    const exists = await redisClient.hexists(hashKey, field); // hexists - 필드가 존재하면 1, 존재하지 않으면 0
    return exists === 1;
  }
}
