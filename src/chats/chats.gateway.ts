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
    console.log(`Client joined room: ${chatRoomId}`);
    client.join(chatRoomId);
  }

  @SubscribeMessage('joinUser')
  handleJoinUser(@ConnectedSocket() client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const decoded = this.jwtService.verify(token);

      console.log(`User ${decoded.id} joined their own room`);
      this.server.to(decoded.id.toString()).emit(decoded.id.toString());
      client.join(decoded.id.toString());
    } catch (e) {
      console.error('Join user failed:', e);
    }
  }

  @SubscribeMessage('send')
  async handleSendMessage(
    @MessageBody()
    data: {
      chatRoomId: number;
      message: string;
      opponentIds: number[];
    },
    @ConnectedSocket() client: Socket,
  ) {
    const token = client.handshake.auth.token; // Socket.IO 미들웨어로 token 잡기
    const { chatRoomId, message, opponentIds } = data;

    try {
      // token decode
      const decoded = await this.jwtService.verify(token);

      const newMessage = await this.chatsService.createMessage(
        chatRoomId,
        decoded,
        message,
      );

      if (newMessage && chatRoomId && opponentIds.length > 0) {
        // 채팅방에 메세지 전송
        this.server
          .to(chatRoomId.toString())
          .emit('chatRoomMessage', newMessage);

        // 개별 유저에게 전송
        for (const memberId of opponentIds) {
          if (memberId !== decoded.id) {
            this.server
              .to(memberId.toString())
              .emit('directMessage', newMessage);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}
