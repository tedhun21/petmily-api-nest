import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UserRole } from 'src/users/entity/user.entity';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entity/message.entity';
import { ChatRoom } from './entity/chatRoom.entity';
import { CreateChatRoomInput } from './dto/create-chatRoom.dto';
import { FindMessageInput } from './dto/find-message.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
  ) {}

  async findChatRoomById(chatRoomId: number | string) {
    return await this.chatRoomRepository.findOne({
      where: { id: +chatRoomId },
    });
  }

  async findChatRoomByUsers(
    user: { id: number; role: UserRole },
    opponentId: string,
  ) {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: [
        { client: { id: user.id }, petsitter: { id: +opponentId } },
        { client: { id: +opponentId }, petsitter: { id: user.id } },
      ],
      relations: ['client', 'petsitter'],
      select: {
        client: { id: true, nickname: true, photo: true },
        petsitter: { id: true, nickname: true, photo: true },
      },
    });

    return chatRoom;
  }

  async createChatRoom(
    user: { id: number; role: UserRole },
    createChatRoomInput: CreateChatRoomInput,
  ) {
    const { opponentId } = createChatRoomInput;

    try {
      let chatRoom;
      if (user.role === UserRole.CLIENT) {
        chatRoom = await this.chatRoomRepository.create({
          client: { id: user.id },
          petsitter: { id: +opponentId },
        });
      } else if (user.role === UserRole.PETSITTER) {
        chatRoom = await this.chatRoomRepository.create({
          client: { id: +opponentId },
          petsitter: { id: user.id },
        });
      }

      await this.chatRoomRepository.save(chatRoom);

      return chatRoom;
    } catch (e) {
      throw new InternalServerErrorException('Fail to create a chat room');
    }
  }

  async findMessages(
    jwtUser: JwtUser,
    params: { chatRoomId: string },
    findMessageInput: FindMessageInput,
  ) {
    const { chatRoomId } = params;
    const { opponentId, page, pageSize } = findMessageInput;

    // chatRoom 유효성 검사
    const chatRoomExists = await this.chatRoomRepository.findOne({
      where: [
        {
          id: +chatRoomId,
          client: { id: jwtUser.id },
          petsitter: { id: +opponentId },
        },
        {
          id: +chatRoomId,
          client: { id: +opponentId },
          petsitter: { id: jwtUser.id },
        },
      ],
    });

    if (!chatRoomExists) {
      return {
        results: null,
        totalMessages: 0,
        pagination: {
          total: 0,
          totalPages: 0,
          page: +page,
          pageSize: +pageSize,
        },
      };
    }

    // 메시지 조회
    const [messages, total] = await this.messagesRepository.findAndCount({
      where: { chatRoom: { id: +chatRoomId } },
      order: { createdAt: 'DESC' },
      relations: ['sender', 'chatRoom'],
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        sender: { id: true },
        chatRoom: { id: true },
      },
      skip: (+page - 1) * +pageSize,
      take: +pageSize,
    });

    const totalPages = Math.ceil(total / +pageSize);

    return {
      results: messages.reverse(),
      pagination: {
        total,
        totalPages,
        page: +page,
        pageSize: +pageSize,
      },
    };
  }

  async saveMessage(
    chatRoomId: number,
    user: { id: number; role: UserRole },
    opponentId: string,
    message: string,
  ) {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: [
        {
          id: chatRoomId,
          client: { id: user.id },
          petsitter: { id: +opponentId },
        },
        {
          id: chatRoomId,
          client: { id: +opponentId },
          petsitter: { id: user.id },
        },
      ],
    });

    try {
      let newMessage;
      if (user.role === UserRole.CLIENT) {
        newMessage = await this.messagesRepository.create({
          chatRoom: { id: chatRoom.id },
          sender: { id: user.id },
          content: message,
        });
      } else if (user.role === UserRole.PETSITTER) {
        newMessage = await this.messagesRepository.create({
          chatRoom: { id: chatRoom.id },
          sender: { id: user.id },
          content: message,
        });
      }

      const savedMessage = await this.messagesRepository.save(newMessage);

      return savedMessage;
    } catch (e) {
      throw new InternalServerErrorException('Fail to send a message');
    }
  }
}
