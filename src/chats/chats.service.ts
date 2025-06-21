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
import { ChatRoom } from './entity/chatRoom.entity';
import { FindMessagesDto } from './dto/find.messages.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { FindChatRoomsDto } from './dto/find.chatRooms.dto';
import { ChatMember } from './entity/chatMember.entity';
import { FindChatRoomByUsersDto } from './dto/find.chatRoomByUsersDto';
import { CreateChatRoomDto } from './dto/create.chatRoom.dto';
import { RedisChatService } from 'src/redis/chat/redis-chat.service';

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
    private readonly redisChatService: RedisChatService,
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

  // redis에 unreadCount가 없으면 -> 계산해서 redis에 넣고 반환
  async findChatRooms(jwtUser: JwtUser, findChatRoomsDto: FindChatRoomsDto) {
    const { id: userId } = jwtUser;
    const { pageSize, cursorId, cursorDate } = findChatRoomsDto;

    // 1. 채팅방 목록 불러오기 (paging + 정렬)
    const qb = this.chatRoomsRepository
      .createQueryBuilder('chatRoom')
      .leftJoinAndSelect('chatRoom.chatMembers', 'chatMember')
      .leftJoin('chatMember.user', 'user')
      .addSelect(['user.id', 'user.nickname', 'user.photo', 'user.role'])
      .leftJoin('chatRoom.lastMessage', 'lastMessage')
      .addSelect([
        'lastMessage.id',
        'lastMessage.content',
        'lastMessage.createdAt',
      ]);

    if (cursorDate && cursorId) {
      qb.andWhere(
        new Brackets((qb1) => {
          qb1
            .where(
              `DATE_TRUNC('milliseconds', lastMessage.createdAT) < :cursorDate`,
              { cursorDate },
            )
            .orWhere(
              new Brackets((qb2) => {
                qb2
                  .where(
                    `DATE_TRUNC('milliseconds', lastMessage.createdAt) = :cursorDate`,
                    { cursorDate },
                  )
                  .andWhere(`lastMessage.id < :cursorId`, { cursorId });
              }),
            );
        }),
      );
    }

    qb.orderBy('lastMessage.createdAt', 'DESC')
      .addOrderBy('lastMessage.id', 'DESC')
      .limit(pageSize);

    const chatRooms = await qb.getMany();

    const hasNextPage = chatRooms.length > pageSize;

    const processed = await Promise.all(
      chatRooms.map(async (room) => {
        const me = room.chatMembers.find((member) => member.user.id === userId);
        const others = room.chatMembers.filter(
          (member) => member.user.id !== userId,
        );

        let unreadCount: number;

        const exists = await this.redisChatService.hasUnreadCount(
          userId,
          room.id,
        );

        if (exists) {
          // ✅ 이미 Redis에 있다면 캐싱된 값
          unreadCount = await this.redisChatService.getUnreadCount(
            userId,
            room.id,
          );
        } else {
          // ❗ 없을 때만 DB 연산 + 캐싱
          unreadCount = await this.getUnreadMessageCountByChatRoom(
            room.id,
            userId,
          );
          await this.redisChatService.setUnreadCount(
            userId,
            room.id,
            unreadCount,
          );
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
        .leftJoin('chatMember.user', 'user')
        .addSelect(['user.id', 'user.nickname', 'user.photo', 'user.role'])
        .leftJoin('chatMember.lastReadMessage', 'lastReadMessage')
        .addSelect(['lastReadMessage.id', 'lastReadMessage.createdAt'])
        .leftJoinAndSelect('chatRoom.lastMessage', 'lastMessage')
        .where('chatRoom.id = :chatRoomId', { chatRoomId })
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

  // 트랜잭션
  // 1. 메세지 저장
  // 2. 채팅방의 `lastMessage` 업데이트
  // 3. sender의 읽음 메시지 업데이트
  // 4. 모든 chatMember 중, 보낸 사람 (sender)을 죄외한 사람들의 redis 캐시 unreadCount +=1
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
      });
      const savedMessage = await manager.save(Message, newMessage);

      // 2. chatRoom의 `lastMessage` 업데이트
      chatRoom.lastMessage = savedMessage; //
      await manager.save(chatRoom);

      // 3. chatRoom에 해당하는 chatMember 뷸러오기
      const chatMembers = await manager.find(ChatMember, {
        where: { chatRoom: { id: chatRoom.id } },
        relations: ['user'],
        select: { user: { id: true } },
      });

      // 4. sender lastReadMessage 업데이트 + 나머지 멤버는 Redis 카운트 증가
      await Promise.all(
        chatMembers.map(async (member) => {
          if (member.user.id === senderId) {
            member.lastReadMessage = savedMessage;
            await manager.save(ChatMember, member);
          } else {
            await this.redisChatService.incremetOrInitUnreadCount(
              member.user.id,
              chatRoomId,
              1,
            );
          }
        }),
      );

      return savedMessage;
    });
  }

  // 유저의 안 읽은 메시지 카운트 조회
  async getUnreadMessageCountByUser(jwtUser: JwtUser) {
    const { id: userId } = jwtUser;

    // 1. 사용자가 속한 모든 채팅방 ID 조회
    const chatRoomIds = await this.chatMembersRepository
      .createQueryBuilder('chatMember')
      .select('chatMember.chatRoom.id', 'chatRoomId')
      .where('chatMember.user.id = :userId', { userId })
      .getRawMany(); // 결과: [{ chatRoomId: 1 }, { chatRoomId: 2 }, ...]

    // 2. Redis에서 모든 캐시된 count 가져오기
    const cachedCounts = await this.redisChatService.getAllUnreadCounts(userId); // hgetall

    let total = 0;

    for (const { chatRoomId } of chatRoomIds) {
      const cached = cachedCounts[chatRoomId];
      if (cached !== undefined) {
        total += Number(cached); // Redis에서 꺼낸 값은 문자열일 수 있음
      } else {
        const count = await this.getUnreadMessageCountByChatRoom(
          chatRoomId,
          userId,
        );
        await this.redisChatService.setUnreadCount(userId, chatRoomId, count);
        total += count;
      }
    }

    return total;
  }

  // 트랜잭션
  // 1. ChatMember(me) `lastMessage` 업데이트
  // 2. redis 캐시 업데이트 ()
  // 외부작업(redis 때문에 queryRunner 사용 - DB 커밋이 확실히 된 후에 작업을 수항해기 때문에 일관성 good)
  async markMessagesAsRead(
    jwtUser: JwtUser,
    chatRoomId: number,
    lastReadMessage: {
      lastReadMessageId: number;
      lastReadMessageCreatedAt: string;
    },
  ) {
    const { id: userId } = jwtUser;
    const { lastReadMessageId, lastReadMessageCreatedAt } = lastReadMessage;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. ChatMember의 lastMessage 업데이트
      const meMember = await queryRunner.manager.findOne(ChatMember, {
        where: { chatRoom: { id: chatRoomId }, user: { id: userId } },
        relations: ['chatRoom', 'user'],
      });

      if (!meMember) throw new NotFoundException('ChatMember not found');

      const message = await queryRunner.manager
        .createQueryBuilder(Message, 'message')
        .where('message.id = :id', { id: lastReadMessageId })
        .andWhere(
          `DATE_TRUNC('milliseconds', message.createdAt) = :lastReadMessageCreatedAt`,
          { lastReadMessageCreatedAt },
        )
        .getOne();

      // 2. 읽음 정보 업데이트
      meMember.lastReadMessage = message;
      await queryRunner.manager.save(meMember);

      // DB 커밋 끝
      await queryRunner.commitTransaction();

      // 3. 안 읽은 메시지 카운트 다시 계산 후, redis 캐시 업데이트
      const unreadCount = await this.getUnreadMessageCountByChatRoom(
        chatRoomId,
        userId,
      );

      await this.redisChatService.setUnreadCount(
        userId,
        chatRoomId,
        unreadCount,
      );
    } catch (e) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  // 채팅방의 안 읽은 메시지 카운트
  async getUnreadMessageCountByChatRoom(
    chatRoomId: number,
    userId: number,
  ): Promise<number> {
    // 1. ChatMember 조회 (lastMessage 가져오기)
    const meMember = await this.chatMembersRepository.findOne({
      where: { chatRoom: { id: chatRoomId }, user: { id: userId } },
      relations: ['lastReadMessage'],
    });

    if (!meMember || !meMember.lastReadMessage) {
      return 0;
    }

    // 2. 메시지 카운트 쿼리
    const count = await this.messagesRepository
      .createQueryBuilder('message')
      .where('message.chatRoomId = :roomId', { roomId: chatRoomId })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            "DATE_TRUNC('milliseconds', message.createdAt) > :lastReadDate",
            {
              lastReadDate: meMember.lastReadMessage.createdAt,
            },
          ).orWhere(
            new Brackets((qb2) => {
              qb2
                .where(
                  "DATE_TRUNC('milliseconds', message.createdAt) = :lastReadDate",
                  { lastReadDate: meMember.lastReadMessage.createdAt },
                )
                .andWhere('message.id > :lastReadId', {
                  lastReadId: meMember.lastReadMessage.id,
                });
            }),
          );
        }),
      )
      .getCount();

    return count;
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
