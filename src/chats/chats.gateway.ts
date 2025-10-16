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
import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from 'src/common/guard/WsJwtGuard';
import { WsExceptionFilter } from 'src/common/filter/ws-exception.filter';

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
    const { user } = client.data;
    const { chatRoomId } = data;

    try {
      client.join(`chatRoom_${chatRoomId}`);
      this.logger.log(`User ${user.id} joined chatRoom_${chatRoomId}`);
    } catch (e) {
      this.logger.error('Invalid token for chat:room:join:', e);
    }
  }

  @UseGuards(WsJwtGuard)
  @UseFilters(WsExceptionFilter)
  @SubscribeMessage('chat:message:new')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    const { user } = client.data;
    const { chatRoomId, opponentIds, tempMessageId, content } = data;

    try {
      // 2. 메시지 생성
      const newMessage = await this.chatsService.createMessage(user, {
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
    } catch (e) {}
  }

  @UseGuards(WsJwtGuard)
  @UseFilters(WsExceptionFilter)
  @SubscribeMessage('chat:read:mark')
  async markReadMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ReadMessageDto,
  ) {
    const { chatRoomId, lastReadMessageId, lastReadMessageCreatedAt } = data;
    const { user } = client.data;

    try {
      await this.chatsService.markMessagesAsRead(user, chatRoomId, {
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
        readBy: user.id,
      });

      // 해당 유저에세 개인적 (채팅방 외부)
      this.server.to(`chatUser_${user.id}`).emit('chat:user:newMessage:clear', {
        lastReadMessage,
        readBy: user.id,
      });
    } catch (e) {}
  }
}
