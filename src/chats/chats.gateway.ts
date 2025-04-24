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

  // 유저가 채팅방에 조인
  @SubscribeMessage('joinChatRoom')
  handleJoinChatRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`chatRoom_${chatRoomId}`);
    console.log(`Client joined room: ${chatRoomId}`);
  }

  @SubscribeMessage('joinChatUser')
  async handleJoinChatUser(@ConnectedSocket() client: Socket) {
    const token = client.handshake.auth.token;

    try {
      const { id: userId } = await this.jwtService.verify(token);

      client.join(`chatUser_${userId.toString()}`);
      console.log(`User ${userId} joined their own room`);
    } catch (e) {
      console.error('Join user failed:', e);
    }
  }

  @SubscribeMessage('sendMessage')
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
          .to(`chatRoom_${chatRoomId.toString()}`)
          .emit('chatRoomMessage', newMessage);

        // 개별 유저에게 전송
        for (const memberId of opponentIds) {
          if (memberId !== decoded.id) {
            this.server
              .to(`chatUser_${memberId.toString()}`)
              .emit('directMessage', newMessage);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  @SubscribeMessage('readMessage')
  async markReadMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data,
  ) {
    const token = client.handshake.auth.token; // Socket.IO 미들웨어로 token 잡기
    const { chatRoomId, messageId } = data;

    try {
      const decoded = await this.jwtService.verify(token);

      await this.chatsService.updateReadMessages(
        decoded,
        chatRoomId,
        messageId,
      );

      // 채팅방에 읽음표시
      this.server.to(`chatRoom_${chatRoomId.toString()}`).emit('readMessage', {
        messageId,
        userId: decoded.id,
      });
    } catch (e) {}
  }
}
