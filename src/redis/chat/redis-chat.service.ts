import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';

@Injectable()
export class RedisChatService {
  constructor(private readonly redisService: RedisService) {}

  // Redis Key: unread_message_count:{userId}
  // Redis Hash Field: {chatRoomId}
  // Redis Hash Value: unreadCount (type string)

  /**
   * 특정 채팅방의 안 읽은 메시지 카운트를 1 증가시킵니다.
   * hincrby 명령어는 필드가 없으면 0으로 시작하므로, 초기화와 증가가 한번에 처리됩니다.
   */
  async incrementUnreadCount(userId: number, chatRoomId: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const hashKey = `unread_message_count:${userId}`;
    const field = chatRoomId.toString();

    await redisClient.hincrby(hashKey, field, 1);
  }

  /**
   * 특정 채팅방의 안 읽은 메시지 카운트를 특정 값으로 설정합니다.
   * count가 0이면 필드를 삭제하여 메모리를 절약합니다.
   */
  async setUnreadCount(userId: number, chatRoomId: number, count: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const hashKey = `unread_message_count:${userId}`;
    const field = chatRoomId.toString();

    if (count === 0) {
      await redisClient.hdel(hashKey, field);
    } else {
      await redisClient.hset(hashKey, field, count.toString());
    }
  }

  // 특정 채팅방의 유저의 안 읽은 카운트 조회
  async getUnreadCount(userId: number, chatRoomId: number) {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return 0; // 0을 반환하도록 수정

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

    return result;
  }

  // 사용자의 총 안 읽은 메시지 수 계산
  async getTotalUnreadCount(userId: number): Promise<number> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return 0;

    const counts = await this.getAllUnreadCounts(userId);
    return (Object.values(counts) as number[]).reduce(
      (total, count) => total + count,
      0,
    );
  }
}
