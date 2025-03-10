import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserRole } from 'src/users/entity/user.entity';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Not, Repository } from 'typeorm';
import { Message } from './entity/message.entity';
import { ChatRoom } from './entity/chatRoom.entity';
import { GetMessagesInput } from './dto/get-message.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { GetChatRoomsInput } from './dto/get-chatRooms.dto';
import { RedisService } from 'src/redis/redis.service';
import { ChatMember } from './entity/chatMember.entity';
import { UpdateUnreadCount } from './dto/update-unreadCount';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly chatRoomsRepository: Repository<ChatRoom>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(ChatMember)
    private readonly chatMembersRepository: Repository<ChatMember>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  async getChatRooms(jwtUser: JwtUser, getChatRoomsInput: GetChatRoomsInput) {
    const { id: userId } = jwtUser;
    const { pageSize, cursor } = getChatRoomsInput;

    let chatRoomsQuery = await this.chatRoomsRepository
      .createQueryBuilder('chatRoom')
      .leftJoinAndSelect('chatRoom.chatMembers', 'chatMembers')
      .leftJoin('chatMembers.user', 'user')
      .addSelect(['user.id', 'user.nickname', 'user.photo', 'user.role'])
      .where(
        (qb) => {
          const subQuery = qb
            .subQuery()
            .select('chatMembers.chatRoomId')
            .from(ChatMember, 'chatMembers')
            .where('chatMembers.userId = :userId')
            .getQuery();

          return `chatRoom.id IN ${subQuery}`;
        },
        { userId },
      )
      .orderBy('chatMembers.updatedAt', 'DESC')
      .take(+pageSize);

    if (cursor) {
      chatRoomsQuery = chatRoomsQuery.where('chatMembers.updatedAt > :cursor', {
        cursor,
      });
    }

    const chatRooms = await chatRoomsQuery.getMany();

    if (chatRooms.length === 0) {
      return {
        results: [],
        pagination: { hasNextPage: false, nextCursor: null },
      };
    }

    const chatRoomIds = chatRooms.map((chatRoom) => chatRoom.id);

    const lastMessages = await this.messagesRepository
      .createQueryBuilder('message')
      .select('message.chatRoomId', 'chatRoomId')
      .addSelect('message.content', 'content')
      .addSelect('message.createdAt', 'createdAt')
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .select('MAX(subMsg.createdAt)')
          .from(Message, 'subMsg')
          .where('subMsg.chatRoomId = message.chatRoomId')
          .getQuery();

        return `message.createdAt = (${subQuery})`;
      })
      .andWhere('message.chatRoomId IN (:...chatRoomIds)', { chatRoomIds })
      .getRawMany();

    const nextCursor =
      chatRooms.length > 0 ? chatRooms[chatRooms.length - 1].id : null;

    const chatRoomsWithLastMessage = chatRooms.map((chatRoom) => {
      const me = chatRoom.chatMembers.find(
        (member) => member.user.id === userId,
      );

      const others = chatRoom.chatMembers
        .filter((member) => member.user.id !== userId)
        .map((member) => ({
          id: member.user.id,
          nickname: member.user.nickname,
          photo: member.user.photo,
          role: member.user.role,
        }));

      const lastMessage = lastMessages.find(
        (msg) => msg.chatRoomId === chatRoom.id,
      );

      return {
        id: chatRoom.id,
        unreadCount: me.unreadCount,
        chatMembers: { me, others },
        lastMessage: lastMessage
          ? { content: lastMessage.content, createdAt: lastMessage.createdAt }
          : null,
      };
    });

    return {
      results: chatRoomsWithLastMessage,
      pagination: { hasNextPage: chatRooms.length === +pageSize, nextCursor },
    };
  }

  async getChatRoom(jwtUser: JwtUser, param: { chatRoomId: string }) {
    const { id: userId } = jwtUser;
    const { chatRoomId } = param;

    try {
      const chatRoom = await this.chatRoomsRepository.findOne({
        where: { id: +chatRoomId },
        relations: ['chatMembers', 'chatMembers.user'],
        select: {
          id: true,
          chatMembers: {
            id: true,
            unreadCount: true,
            user: { id: true, nickname: true, photo: true },
            createdAt: true,
            updatedAt: true,
          },
        },
      });

      // 현재 사용자 정보 찾기
      const me =
        chatRoom.chatMembers.find((member) => member.user.id === userId) ||
        null;
      // 상대방 정보 필터링
      const others = chatRoom.chatMembers
        .filter((member) => member.user.id !== userId)
        .map((member) => ({
          id: member.user.id,
          nickname: member.user.nickname,
          photo: member.user.photo,
          role: member.user.role,
        }));

      return {
        id: chatRoom.id,
        chatMembers: { me, others },
        createdAt: chatRoom.createdAt,
        updatedAt: chatRoom.updatedAt,
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to get chat room');
    }
  }

  async getChatRoomByUsers(jwtUser: JwtUser, opponentIds: number[]) {
    const { id: userId } = jwtUser;
    const allUserIds = [userId, ...opponentIds];

    const chatRoom = await this.checkExistingChatRoom(allUserIds);

    if (!chatRoom) {
      return null;
    }

    // chatMembers에서 me와 others를 분리
    const meMember = chatRoom.chatMembers.find(
      (member) => member.user.id === userId,
    );
    const others = chatRoom.chatMembers.filter(
      (member) => member.user.id !== userId,
    );

    const modifiedChatRoom = {
      id: chatRoom.id,
      chatMembers: {
        me: meMember,
        others: others.map((member) => ({
          id: member.user.id,
          nickname: member.user.nickname,
          photo: member.user.photo,
          role: member.user.role,
        })),
      },
    };

    return modifiedChatRoom;
  }

  async createChatRoom(
    user: { id: number; role: UserRole },
    opponentIds: number[],
  ) {
    if (!opponentIds.includes(user.id)) {
      opponentIds.push(user.id);
    }

    const chatRoomExists = await this.checkExistingChatRoom(opponentIds);

    if (chatRoomExists) {
      throw new ConflictException('Chat room already exists');
    }

    // 트랜잭션
    return await this.dataSource.transaction(async (manager) => {
      try {
        // chatRoom 생성 및 저장
        const chatRoom = manager.create(ChatRoom, {});
        const savedChatRoom = await manager.save(chatRoom);

        if (!savedChatRoom) {
          throw new InternalServerErrorException('Failed to save chat room');
        }

        // chatMembers 생성 및 저장
        const chatMembers = opponentIds.map((userId) =>
          manager.create(ChatMember, {
            user: { id: userId },
            chatRoom: savedChatRoom,
          }),
        );

        await manager.save(chatMembers);

        // chatMembers 조회
        const savedChatMembers = await manager.find(ChatMember, {
          where: { chatRoom: { id: savedChatRoom.id } },
          relations: ['user'],
          select: {
            id: true,
            unreadCount: true,
            user: { id: true, nickname: true, role: true, photo: true },
          },
        });

        if (!savedChatMembers || savedChatMembers.length === 0) {
          throw new InternalServerErrorException(
            'Failed to fetch chat members',
          );
        }

        // me와 others 구분
        const me = savedChatMembers.find(
          (member) => member.user.id === user.id,
        );
        const others = savedChatMembers.filter(
          (member) => member.user.id !== user.id,
        );

        if (!me) {
          throw new InternalServerErrorException(
            'Failed to find current user in chat room',
          );
        }

        // 원하는 구조로 반환
        return {
          id: savedChatRoom.id,
          chatMembers: {
            me: {
              id: me.user.id,
              nickname: me.user.nickname,
              photo: me.user.photo,
              role: me.user.role,
              unreadCount: me.unreadCount,
            },
            others: others.map((member) => ({
              id: member.user.id,
              nickname: member.user.nickname,
              photo: member.user.photo,
              role: member.user.role,
            })),
          },
        };
      } catch (e) {
        console.error('Error creating chat room:', e);
        throw new InternalServerErrorException('Fail to create a chat room');
      }
    });
  }

  async getMessages(
    jwtUser: JwtUser,
    params: { chatRoomId: string },
    getMessagesInput: GetMessagesInput,
  ) {
    const { id: userId } = jwtUser;
    const { chatRoomId } = params;
    const { cursor, pageSize } = getMessagesInput;

    // chatRoom 유효성 검사

    const chatRoomExists = await this.chatRoomsRepository.findOne({
      where: { id: +chatRoomId, chatMembers: { user: { id: userId } } },
    });

    if (!chatRoomExists) {
      return {
        results: null,
        pagination: {
          total: 0,
          totalPages: 0,
          page: 1,
          pageSize: +pageSize,
        },
      };
    }

    // 커서 기반으로 메시지 조회
    const queryOptions: any = {
      where: { chatRoom: { id: +chatRoomId } },
      order: { createdAt: 'DESC' },
      relations: ['sender', 'chatRoom'],
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: { id: true },
        chatRoom: { id: true },
      },
      take: +pageSize,
    };

    if (cursor) {
      // cursor는 마지막 메시지의 id로 사용
      const cursorMessage = await this.messagesRepository.findOne({
        where: { id: +cursor, chatRoom: { id: +chatRoomId } },
        select: ['id', 'createdAt'],
      });

      // 커서 이후의 메시지만 조회
      queryOptions.where.createdAt = LessThan(cursorMessage.createdAt);
    }

    // 메시지 조회
    const [messages, total] =
      await this.messagesRepository.findAndCount(queryOptions);

    // 커서가 있으면 다음 페이지가 존재하는지 확인
    const hasNextPage = messages.length === +pageSize;

    const pagination = {
      total,
      totalPages: Math.ceil(total / +pageSize),
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
      hasNextPage,
    };

    return {
      results: messages,
      pagination,
    };
  }

  // 메세지 저장 + unreadCount (트랜잭션)
  async createMessage(
    chatRoomId: number,
    user: { id: number; role: UserRole },
    message: string,
  ) {
    const { id: userId } = user;
    // 채팅방 찾기
    const chatRoom = await this.chatRoomsRepository.findOne({
      where: { id: chatRoomId },
    });

    if (!chatRoom) {
      throw new InternalServerErrorException('No chat room found');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. 메세지 생성
      const newMessage = manager.create(Message, {
        chatRoom: { id: chatRoom.id },
        sender: { id: userId },
        content: message,
        readBy: [userId],
      });

      // 2. 메세지 저장
      const savedMessage = await manager.save(Message, newMessage);

      // 3. 채팅 멤버 목록 가져오기 (현재 유저 제외)
      const chatMembers = await manager.find(ChatMember, {
        where: { chatRoom: { id: chatRoomId }, user: { id: Not(userId) } },
      });

      // 4. 상대방의 unreadCount 증가
      for (const chatMember of chatMembers) {
        chatMember.unreadCount += 1;
        await manager.save(chatMember);
      }

      return savedMessage;
    });
  }

  async updateUnreadCount(
    jwtUser: JwtUser,
    updateUnreadCountQuery,
    updateUnreadCount: UpdateUnreadCount,
  ) {
    const { id: userId } = jwtUser;
    const { action } = updateUnreadCountQuery;
    const { chatRoomId } = updateUnreadCount;

    // chatMember 가져오기
    const chatMember = await this.chatMembersRepository.findOne({
      where: { user: { id: userId }, chatRoom: { id: chatRoomId } },
    });

    if (!chatMember) {
      throw new InternalServerErrorException('No chat room information');
    }

    if (action === 'increment') {
      chatMember.unreadCount += 1;
    } else if (action === 'reset') {
      chatMember.unreadCount = 0;
    }

    try {
      await this.chatMembersRepository.save(chatMember);
      return { message: `Successfully updated ${action} unread count` };
    } catch (e) {
      throw new InternalServerErrorException('Fail to update unread count');
    }
  }

  async checkExistingChatRoom(memberIds: number[]) {
    const subQuery = this.chatRoomsRepository
      .createQueryBuilder('chatRoom')
      .select('chatRoom.id')
      .leftJoin('chatRoom.chatMembers', 'chatMember')
      .leftJoin('chatMember.user', 'user')
      .where('user.id IN (:...userIds)', { userIds: memberIds })
      .groupBy('chatRoom.id')
      .having('COUNT(chatMember.id) = :userCount', {
        userCount: memberIds.length,
      });

    const chatRoom = await this.chatRoomsRepository
      .createQueryBuilder('chatRoom')
      .where(`chatRoom.id IN (${subQuery.getQuery()})`)
      .setParameters(subQuery.getParameters())
      .leftJoinAndSelect('chatRoom.chatMembers', 'chatMember')
      .leftJoin('chatMember.user', 'user')
      .addSelect([
        'user.id',
        'user.nickname',
        'user.photo',
        'user.role',
        'chatMember.updatedAt',
      ])
      .getOne();

    return chatRoom;
  }
}
