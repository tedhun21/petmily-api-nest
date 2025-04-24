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
import { Notification } from './entity/notification.entity';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayInit {
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
      console.log('NotificationGateway Socket.IO Redis 어댑터 설정 완료');
    } catch (error) {
      console.error(
        'NotificationGateway Socket.IO Redis 어댑터 설정 오류:',
        error,
      );
    }
  }

  @SubscribeMessage('joinNotiUser')
  async handleJoinNoti(@ConnectedSocket() client: Socket) {
    const token = client.handshake.auth.token;

    try {
      const decoded = await this.jwtService.verify(token);
      const { id: userId } = decoded;

      console.log(`🟢 User ${userId} joined room notiUser_${userId}`);

      client.join(`notiUser_${userId}`);
    } catch (e) {
      console.error(e);
    }
  }

  async sendNotificationsToUsers(
    userIds: number[],
    notification: Notification,
  ) {
    // 웹 소켓 알림
    for (const userId of userIds) {
      this.server
        .to(`notiUser_${userId.toString()}`)
        .emit('notification', notification);
    }
  }
}
