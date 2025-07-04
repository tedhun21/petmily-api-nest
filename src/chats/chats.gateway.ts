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
import { SendMessageDto } from './dto/send.message.dto';
import { ReadMessageDto } from './dto/read.message.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatsGateWay {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly jwtService: JwtService,
  ) {}
  @WebSocketServer()
  server: Server;

  // 유저가 채팅방에 조인
  @SubscribeMessage('chat:room:join')
  handleJoinChatRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`chatRoom_${chatRoomId}`);
    console.log(`Client joined room: ${chatRoomId}`);
  }

  @SubscribeMessage('chat:user:join')
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

  @SubscribeMessage('chat:message:new')
  async handleSendMessage(
    @MessageBody()
    data: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const token = client.handshake.auth.token; // Socket.IO 미들웨어로 token 잡기
    const { chatRoomId, opponentIds, message } = data;

    try {
      // token decode
      const decoded = await this.jwtService.verify(token);

      // 1. 메시지 생성
      const newMessage = await this.chatsService.createMessage(
        decoded,
        chatRoomId,
        message,
      );

      console.log('newMessage', newMessage);

      const roomMessagePayload = {
        ...newMessage,
        chatRoom: {
          id: newMessage.chatRoom.id,
        },
        sender: { ...newMessage.sender },
      };

      if (newMessage && chatRoomId && opponentIds.length > 0) {
        // 채팅방에 메세지 전송
        this.server
          .to(`chatRoom_${chatRoomId.toString()}`)
          .emit('chat:room:message:new', roomMessagePayload);

        // 상대방 유저에게 전송
        for (const memberId of opponentIds) {
          if (memberId !== decoded.id) {
            this.server
              .to(`chatUser_${memberId.toString()}`)
              .emit('chat:user:message:new', newMessage);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  @SubscribeMessage('chat:read:mark')
  async markReadMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ReadMessageDto,
  ) {
    const token = client.handshake.auth.token;

    const { chatRoomId, lastReadMessageId, lastReadMessageCreatedAt } = data;

    try {
      const decoded = await this.jwtService.verify(token);

      await this.chatsService.markMessagesAsRead(decoded, chatRoomId, {
        lastReadMessageId,
        lastReadMessageCreatedAt,
      });

      const lastReadMessage = {
        id: lastReadMessageId,
        createdAt: lastReadMessageCreatedAt,
        chatRoom: { id: chatRoomId },
      };

      // 채팅방에 있는 모든 참여자에게 (채팅방 내부) 읽음 표시 broadcast
      this.server
        .to(`chatRoom_${chatRoomId.toString()}`)
        .emit('chat:room:read:update', { lastReadMessage, readBy: decoded.id });

      // 해당 유저에세 개인적 (채팅방 외부)
      this.server
        .to(`chatUser_${decoded.id}`)
        .emit('chat:user:newMessage:clear', {
          lastReadMessage,
          readBy: decoded.id,
        });
    } catch (e) {}
  }
}
