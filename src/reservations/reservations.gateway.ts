import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ReservationsService } from './reservations.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ReservationsGateWay {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reservationsService: ReservationsService,
  ) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinReservation')
  handleListenStatus(
    @MessageBody() reservationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`Client joined reservation: ${reservationId}`);
    client.join(reservationId);
  }

  @SubscribeMessage('updateStatus')
  async handleUpdateStatus(
    @MessageBody() data,
    @ConnectedSocket() client: Socket,
  ) {
    const token = client.handshake.auth.token;
    const { reservationId, newStatus } = data;

    try {
      // token decode
      const decoded = await this.jwtService.verify(token);

      await this.reservationsService.update(
        decoded,
        { id: reservationId },
        { status: newStatus },
      );

      this.server
        .to(reservationId.toString())
        .emit('listenStatus', { newStatus });
    } catch (e) {
      console.error(e);
    }
  }
}
