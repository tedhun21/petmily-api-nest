import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, Socket } from 'socket.io';
import { RedisService } from 'src/redis/redis.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayInit {
  private readonly logger = new Logger(NotificationsGateway.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  @WebSocketServer()
  server: Server;

  // redis pub/sub 이용해서 adapter 공유
  async afterInit() {
    try {
      const pubClient = this.redisService.getPublisherClient();

      await pubClient.ping();
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) =>
        console.error('Redis Pub Client Error', err),
      );
      subClient.on('error', (err) =>
        console.error('Redis Sub Client Error', err),
      );
      // Redis 연결 성공 시, Socket.IO Redis 어댑터 설정
      this.server.adapter(createAdapter(pubClient, subClient) as any);
      this.logger.log('NotificationGateway Socket.IO Redis 어댑터 설정 완료');
    } catch (error) {
      this.logger.error(
        'NotificationGateway Socket.IO Redis 어댑터 설정 오류:',
        error,
      );
    }
  }

  @SubscribeMessage('noti:user:join')
  async handleJoinNoti(@ConnectedSocket() client: Socket) {
    const { access_token } = client.handshake.auth;

    try {
      const decoded = await this.jwtService.verifyAsync(access_token);
      const { id: userId } = decoded;

      this.logger.log(`🟢 User ${userId} joined room notiUser_${userId}`);

      client.join(`notiUser_${userId}`);
    } catch (e) {
      this.logger.error('🔴 Invalid token for noti:user:join:', e.message);
    }
  }

  async sendNotificationsToUsers(userIds: number[], notification: any) {
    // 웹 소켓 알림
    for (const userId of userIds) {
      this.server
        .to(`notiUser_${userId.toString()}`)
        .emit('noti:user:newNoti', notification);
    }
  }
}
