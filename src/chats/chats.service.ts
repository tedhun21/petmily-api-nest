import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from 'src/users/entity/user.entity';

import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, LessThan, Repository } from 'typeorm';
import { Message } from './entity/message.entity';
import { ChatRoom, ILastMessageInfo } from './entity/chatRoom.entity';
import { FindMessagesDto } from './dto/find.messages.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { FindChatRoomsDto } from './dto/find.chatRooms.dto';
import { ChatMember } from './entity/chatMember.entity';
import { FindChatRoomByUsersDto } from './dto/find.chatRoomByUsersDto';
import { CreateChatRoomDto } from './dto/create.chatRoom.dto';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly chatRoomsRepository: Repository<ChatRoom>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(ChatMember)
    private readonly chatMembersRepository: Repository<ChatMember>,
    private readonly dataSource: DataSource,
  ) {}

  async createChatRoom(
    user: { id: number; role: UserRole },
    createChatRoomDto: CreateChatRoomDto,
  ) {
    const { opponentIds } = createChatRoomDto;
    if (!opponentIds.includes(user.id)) {
      opponentIds.push(user.id);
    }

    const chatRoomExists = await this.checkExistingChatRoom(opponentIds);

    if (chatRoomExists) {
      throw new ConflictException('Chat room already exists');
    }

    // 트랜잭션
    return await this.dataSource.transaction(async (manager) => {
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
          user: { id: true, nickname: true, role: true, photo: true },
        },
      });

      if (!savedChatMembers || savedChatMembers.length === 0) {
        throw new InternalServerErrorException('Failed to fetch chat members');
      }

      // me와 others 구분
      const me = savedChatMembers.find((member) => member.user.id === user.id);
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
          },
          others: others.map((member) => ({
            id: member.user.id,
            nickname: member.user.nickname,
            photo: member.user.photo,
            role: member.user.role,
          })),
        },
      };
    });
  }

  async findChatRooms(jwtUser: JwtUser, findChatRoomsDto: FindChatRoomsDto) {
    const { id: userId } = jwtUser;
    const { pageSize, cursorId, cursorCreatedAt } = findChatRoomsDto;

    // 1. 채팅방 목록 불러오기 (paging + 정렬)
    const qb = this.chatRoomsRepository
      .createQueryBuilder('chatroom')
      .leftJoinAndSelect('chatroom.chatMembers', 'chatmember')
      .leftJoin('chatmember.user', 'user')
      .addSelect(['user.id', 'user.nickname', 'user.photo', 'user.role']);

    if (cursorCreatedAt && cursorId) {
      // 만약 cursorCreatedAt이 lastMessage.createdAt과 같다면, lastMessage.id가 cursorId보다 더 작은 경우만 이전 데이터로 간주
      qb.andWhere(
        new Brackets((qb1) => {
          qb1
            .where(
              `("chatroom"."lastMessage"->>'createdAt')::timestamp < :cursorCreatedAt`,
              { cursorCreatedAt },
            )
            .orWhere(
              `(("chatroom"."lastMessage"->>'createdAt')::timestamp = :cursorCreatedAt AND ("chatroom"."lastMessage"->>'id')::int < :cursorId)`,
              {
                cursorCreatedAt,
                cursorId,
              },
            );
        }),
      );
    }

    qb.addSelect(
      `("chatroom"."lastMessage"->>'createdAt')::timestamp`,
      'lastSentAt',
    );

    qb.orderBy(
      `("chatroom"."lastMessage"->>'createdAt')::timestamp`,
      'DESC',
    ).addOrderBy(`("chatroom"."lastMessage"->>'id')::int`, 'DESC');

    const chatRooms = await qb.getMany();

    const hasNextPage = chatRooms.length > pageSize;

    const processed = await Promise.all(
      chatRooms.map(async (room) => {
        const me = room.chatMembers.find((m) => m.user.id === userId);
        const others = room.chatMembers.filter((m) => m.user.id !== userId);

        let unreadCount = 0;
        if (
          room.lastMessage?.createdAt &&
          me?.lastSeenMessageCreatedAt &&
          me?.lastSeenMessageId !== undefined
        ) {
          unreadCount = await this.messagesRepository
            .createQueryBuilder('message')
            .where('message.chatRoomId = :roomId', { roomId: room.id })
            .andWhere(
              new Brackets((qb) => {
                qb.where(
                  // Date(microseconds)랑 JS객체(milliseconds) 비교시 일치 x
                  // 비교 정밀도 일치
                  `DATE_TRUNC('milliseconds', message.createdAt) > :lastSeenDate`,
                  {
                    lastSeenDate: me.lastSeenMessageCreatedAt,
                  },
                ).orWhere(
                  new Brackets((qb2) => {
                    qb2
                      .where(
                        `DATE_TRUNC('milliseconds', message.createdAt) = :lastSeenDate`,
                        { lastSeenDate: me.lastSeenMessageCreatedAt },
                      )
                      .andWhere('message.id > :lastSeenId', {
                        lastSeenId: me.lastSeenMessageId,
                      });
                  }),
                );
              }),
            )
            .getCount();
        }

        return {
          ...room,
          chatMembers: {
            me: { ...me, unreadCount },
            others,
          },
        };
      }),
    );

    const nextCursor =
      hasNextPage && processed.length > 0
        ? processed[processed.length - 1].lastMessage?.createdAt
        : null;

    return { results: processed, pagination: { nextCursor, hasNextPage } };
  }

  async findChatRoom(jwtUser: JwtUser, chatRoomId: number) {
    const { id: userId } = jwtUser;

    try {
      const chatRoom = await this.chatRoomsRepository
        .createQueryBuilder('chatRoom')
        .leftJoinAndSelect('chatRoom.chatMembers', 'chatMember')
        .leftJoinAndSelect('chatMember.user', 'user')
        .where('chatRoom.id = :chatRoomId', { chatRoomId })
        .select([
          'chatRoom.id',
          'chatRoom.lastMessage', // JSONB 컬럼도 선택 가능
          'chatMember.id',
          'user.id',
          'user.nickname',
          'user.photo',
          'user.role',
        ])
        .getOne();

      // 현재 사용자 정보 찾기
      const me = chatRoom.chatMembers.find(
        (member) => member.user.id === userId,
      );

      // 상대방 정보 필터링
      const others = chatRoom.chatMembers.filter(
        (member) => member.user.id !== userId,
      );

      return {
        id: chatRoom.id,
        chatMembers: { me, others },
        lastMessage: chatRoom.lastMessage,
        createdAt: chatRoom.createdAt,
        updatedAt: chatRoom.updatedAt,
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to get chat room');
    }
  }

  async findChatRoomByUsers(jwtUser: JwtUser, query: FindChatRoomByUsersDto) {
    const { id: userId } = jwtUser;
    const { opponentIds } = query;
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

  async findMessages(
    jwtUser: JwtUser,
    chatRoomId: number,
    findMessagesDto: FindMessagesDto,
  ) {
    const { id: userId } = jwtUser;
    const { cursor, pageSize } = findMessagesDto;

    // chatRoom 유효성 검사
    const chatRoom = await this.chatRoomsRepository.findOne({
      where: { id: +chatRoomId },
      relations: ['chatMembers', 'chatMembers.user'],
    });

    const isMember = chatRoom.chatMembers.some(
      (member) => member.user.id === userId,
    );

    if (!chatRoom || !isMember) {
      return {
        results: null,
        pagination: {
          total: 0,
          totalPages: 0,
          page: 1,
          pageSize,
        },
      };
    }

    // 커서 기반으로 메시지 조회
    const queryOptions: any = {
      where: { chatRoom: { id: +chatRoomId } },
      order: { createdAt: 'DESC' },
      relations: ['sender'],
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: { id: true, nickname: true, photo: true, role: true },
        readBy: true,
      },
      take: pageSize,
    };

    if (cursor) {
      // cursor는 마지막 메시지의 id로 사용
      const cursorMessage = await this.messagesRepository.findOne({
        where: { id: cursor, chatRoom: { id: +chatRoomId } },
        select: ['id', 'createdAt'],
      });

      // 커서 이후의 메시지만 조회
      queryOptions.where.createdAt = LessThan(cursorMessage.createdAt);
    }

    // 메시지 조회
    const [messages, total] =
      await this.messagesRepository.findAndCount(queryOptions);

    // 커서가 있으면 다음 페이지가 존재하는지 확인
    const hasNextPage = messages.length === pageSize;

    const pagination = {
      total,
      totalPages: Math.ceil(total / pageSize),
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
      hasNextPage,
    };

    return {
      results: messages,
      pagination,
    };
  }

  // 트랜잭션 // 메세지 저장 & chatMember unreadCount & 유저 unread count 증가
  async createMessage(jwtUser: JwtUser, chatRoomId: number, message: string) {
    const { id: senderId } = jwtUser;

    // 채팅방 찾기
    const chatRoom = await this.chatRoomsRepository.findOne({
      where: { id: chatRoomId },
    });

    if (!chatRoom) {
      throw new InternalServerErrorException('No chat room found');
    }

    // 트랜잭션
    return await this.dataSource.transaction(async (manager) => {
      // 1. 메세지 생성 및 저장
      const newMessage = manager.create(Message, {
        chatRoom: { id: chatRoom.id },
        sender: { id: senderId },
        content: message,
        readBy: [senderId],
      });
      const savedMessage = await manager.save(Message, newMessage);

      // 3. ChatRoom의 `lastMessage` 업데이트
      const lastMessageInfo: ILastMessageInfo = {
        id: savedMessage.id,
        content: savedMessage.content,
        createdAt: savedMessage.createdAt,
        senderId: savedMessage.sender.id,
      };

      chatRoom.lastMessage = lastMessageInfo; //
      await manager.save(chatRoom);

      return savedMessage;
    });
  }

  async updateReadByMessages(
    jwtUser: JwtUser,
    chatRoomId: number,
    lastSeenMessage: Message,
  ) {
    // 1. 특정 채팅방에 속한 메시지들만
    // 2. 메시지의 createdAt이 lastSeenMessageCreatedAt보다 이전
    // 3. readBy 배열에 해당 유저 ID가 포함되지 않은 메시지들만
    // 4. -> 위 조건을 만족하는 메시디르의 readBy 필드에 userId 추가
    const { id: userId } = jwtUser;

    // 1. 채팅방 조회 및 유저가 멤버인지 확인
    const chatRoom = await this.chatRoomsRepository.findOne({
      where: { id: chatRoomId },
      relations: ['chatMembers', 'chatMembers.user'],
    });

    const isMember = chatRoom?.chatMembers.some(
      (member) => member.user.id === userId,
    );

    if (!chatRoom || !isMember) {
      throw new NotFoundException('No chat room found');
    }

    // 서버에서 1ms 보정
    const correctedTime = new Date(
      new Date(lastSeenMessage.createdAt).getTime() + 1,
    );

    // 2. 메시지 업데이트: 조건 만족 시 readBy에 userId 추가
    await this.messagesRepository
      .createQueryBuilder('message')
      .update()
      .set({
        readBy: () => `array_append(COALESCE("readBy", '{}'), :userId)`,
      })
      .where('"message"."chatRoomId" = :chatRoomId', { chatRoomId })
      .andWhere('"message"."createdAt" <= :lastSeenMessageCreatedAt', {
        lastSeenMessageCreatedAt: correctedTime,
      })
      .andWhere(`NOT (:userId = ANY("message"."readBy"))`, { userId })
      .execute();
  }

  async updateLastMessageChatMember(
    jwtUser: JwtUser,
    chatRoomId: number,
    lastSeenMessage: Message,
  ) {
    const { id: userId } = jwtUser;

    const chatMember = await this.chatMembersRepository.findOne({
      where: { chatRoom: { id: chatRoomId }, user: { id: userId } },
    });

    chatMember.lastSeenMessageId = lastSeenMessage.id;
    chatMember.lastSeenMessageCreatedAt = lastSeenMessage.createdAt;

    await this.chatMembersRepository.save(chatMember);

    return { message: 'Successfully update chatMember' };
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
