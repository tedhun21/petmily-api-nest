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
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from 'src/common/guard/WsJwtGuard';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatsGateWay {
  private readonly logger = new Logger(ChatsGateWay.name);

  constructor(
    private readonly chatsService: ChatsService,
    private readonly jwtService: JwtService,
  ) {}
  @WebSocketServer()
  server: Server;

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:user:join')
  async handleJoinChatUser(@ConnectedSocket() client: Socket) {
    try {
      const { id: userId } = client.data.user;

      client.join(`chatUser_${userId.toString()}`);
      this.logger.log(`🟢 User ${userId} joined their own room`);
    } catch (e) {
      this.logger.error('🔴 Invalid token for chat:user:join:', e);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:room:join')
  async handleJoinChatRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data,
  ) {
    const { id: userId } = client.data.user;
    const { chatRoomId } = data;

    try {
      client.join(`chatRoom_${chatRoomId}`);
      this.logger.log(`User ${userId} joined chatRoom_${chatRoomId}`);
    } catch (e) {
      this.logger.error('Invalid token for chat:room:join:', e);
    }
  }

  @SubscribeMessage('chat:message:new')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    const { chatRoomId, opponentIds, tempMessageId, content } = data;
    const { access_token } = client.handshake.auth;

    try {
      // 1. 토큰 검증
      const decoded = await this.jwtService.verifyAsync(access_token);

      // 2. 메시지 생성
      const newMessage = await this.chatsService.createMessage(decoded, {
        chatRoomId,
        opponentIds,
        content,
      });

      if (!newMessage) {
        return { success: false, error: 'sendFailed', id: tempMessageId };
      }

      const newChatRoomId = newMessage.chatRoom.id;

      // 채팅방 참여자 목록
      const memberIds =
        await this.chatsService.getChatRoomMemberIds(newChatRoomId);

      // 채팅방에 없는 유저에게 메시지 전송
      const socketsInRoom = await this.server
        .in(`chatRoom_${newMessage.chatRoom.id}`)
        .fetchSockets();
      const userIdsInRoom = socketsInRoom.map((s) => s.data.user.id);
      const userIdsNotInRoom = memberIds.filter(
        (id) => !userIdsInRoom.includes(id),
      );

      // 분기 처리
      if (chatRoomId && !opponentIds) {
        // 채팅방 안에 있는 유저에게
        this.server
          .to(`chatRoom_${newChatRoomId}`)
          .emit('chat:room:message:new', { newMessage, tempMessageId });

        // 채팅방 외부에 있는 유저에게
        for (const userId of userIdsNotInRoom) {
          this.server
            .to(`chatUser_${userId}`)
            .emit('chat:user:message:new', newMessage);
        }

        return {
          success: true,
          newMessage,
          tempMessageId,
        };
      } else if (!chatRoomId && opponentIds) {
        // 채팅방 멤버들에게 일괄 방송
        for (const userId of memberIds) {
          this.server
            .to(`chatUser_${userId}`)
            .emit('chat:user:message:new', newMessage);
        }

        return {
          success: true,
          id: newMessage.id,
          chatRoomId: newChatRoomId,
          tempMessageId,
        };
      }
    } catch (e) {
      return {
        success: false,
        error: e.name,
        id: tempMessageId,
      };
    }
  }

  @SubscribeMessage('chat:read:mark')
  async markReadMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ReadMessageDto,
  ) {
    const { access_token } = client.handshake.auth;

    const { chatRoomId, lastReadMessageId, lastReadMessageCreatedAt } = data;

    try {
      const decoded = await this.jwtService.verifyAsync(access_token);

      await this.chatsService.markMessagesAsRead(decoded, chatRoomId, {
        lastReadMessageId,
        lastReadMessageCreatedAt,
      });

      const lastReadMessage = {
        id: lastReadMessageId,
        chatRoom: { id: chatRoomId },
        createdAt: lastReadMessageCreatedAt,
      };

      // 채팅방에 있는 모든 참여자에게 (채팅방 내부) 읽음 표시 broadcast
      this.server.to(`chatRoom_${chatRoomId}`).emit('chat:room:read:update', {
        chatRoomId,
        lastReadMessage,
        readBy: decoded.id,
      });

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
