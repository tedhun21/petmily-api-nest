import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ReservationsService } from './reservations.service';
import { ReservationStatus } from './entity/reservation.entity';
import { RedisService } from 'src/redis/redis.service';
import { createAdapter } from '@socket.io/redis-adapter';

@WebSocketGateway({ cors: { origin: '*' } })
export class ReservationsGateWay implements OnGatewayInit {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reservationsService: ReservationsService,
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

      // Redis 클라이언트 에러 핸들링
      pubClient.on('error', (err) =>
        console.error('Redis Pub Client Error', err),
      );
      subClient.on('error', (err) =>
        console.error('Redis Sub Client Error:', err),
      );
      // Redis 연결 성공 시, Socket.IO Redis 어댑터 설정
      this.server.adapter(createAdapter(pubClient, subClient) as any);
      console.log('ReservationGateway Socket.IO Redis 어댑터 설정 완료');
    } catch (error) {
      console.error(
        'ReservationGateway Socket.IO Redis 어댑터 설정 오류:',
        error,
      );
    }
  }

  @SubscribeMessage('joinReservation')
  handleListenStatus(
    @MessageBody() reservationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`reservation_${reservationId}`);
    console.log(`Client joined reservation: ${reservationId}`);
  }

  @SubscribeMessage('updateStatus')
  async handleUpdateStatus(
    @MessageBody()
    data: { reservationId: number; newStatus: ReservationStatus },
    @ConnectedSocket() client: Socket,
  ) {
    const token = client.handshake.auth.token;
    const { reservationId, newStatus } = data;

    try {
      const decoded = await this.jwtService.verify(token);
      const { id: userId, role: userRole } = decoded;

      // 1. 예약 업데이트
      await this.reservationsService.updateAndNotify(reservationId, newStatus, {
        id: userId,
        role: userRole,
      });

      // 2. 웹소켓 채널로 상태 변경 전송 (to 프론트)
      this.server
        .to(`reservation_${reservationId.toString()}`)
        .emit('listenStatus', { newStatus });
    } catch (e) {
      console.error(e);
    }
  }
}
