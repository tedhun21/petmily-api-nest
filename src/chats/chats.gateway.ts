import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { ChatsService } from './chats.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatsGateWay {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly jwtService: JwtService,
  ) {}
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(chatRoomId);
    console.log(`Client joined room: ${chatRoomId}`);
  }

  @SubscribeMessage('send')
  async handleSendMessage(
    @MessageBody()
    data: {
      chatRoomId?: number;
      opponentId: string;
      message: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const token = client.handshake.auth.token; // Socket.IO 미들웨어로 token 잡기
    const { chatRoomId, opponentId, message } = data;

    try {
      // token decode
      const decoded = await this.jwtService.verify(token);

      const newMessage = await this.chatsService.saveMessage(
        chatRoomId,
        decoded,
        opponentId,
        message,
      );

      this.server.to(chatRoomId.toString()).emit('receive', newMessage);
    } catch (e) {
      console.error(e);
    }
  }
}
