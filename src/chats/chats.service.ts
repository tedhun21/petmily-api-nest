import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { Message } from './entity/message.entity';
import { ChatRoom } from './entity/chatRoom.entity';
import { FindMessagesDto } from './dto/find.messages.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { FindChatRoomsDto } from './dto/find.chatRooms.dto';
import { ChatMember } from './entity/chatMember.entity';
import { CreateChatRoomDto } from './dto/create.chatRoom.dto';
import { RedisChatService } from 'src/redis/chat/redis-chat.service';
import { FindChatRoomByUsersDto } from './dto/find.chatRoomByUsersDto';
import { CreateMessageDto } from './dto/create.message.dto';

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

  async createChatRoom(jwtUser: JwtUser, createChatRoomDto: CreateChatRoomDto) {
    const { id: userId } = jwtUser;
    const { opponentIds } = createChatRoomDto;

    if (!opponentIds.includes(userId)) {
      opponentIds.push(userId);
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

      const meMember = savedChatMembers.find(
        (member) => member.user.id === userId,
      );
      const otherMembers = savedChatMembers.filter(
        (member) => member.user.id !== userId,
      );

      if (!meMember) {
        throw new InternalServerErrorException(
          'Failed to find current user in chat room',
        );
      }

      // 원하는 구조로 반환
      return {
        id: savedChatRoom.id,
        chatMembers: {
          meMember,
          otherMembers,
        },
      };
    });
  }

  // 개선할 점: getAllUnreadCounts에서 room.id에 맞는 걸로 찾기
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

    const hasNextPage = chatRooms.length === pageSize;

    // 사용자의 모든 안 읽은 카운트
    const allUnreadCounts =
      await this.redisChatService.getAllUnreadCounts(userId);

    const processed = await Promise.all(
      chatRooms.map(async (room) => {
        const meMember = room.chatMembers.find(
          (member) => member.user?.id === userId,
        );
        const otherMembers = room.chatMembers.filter(
          (member) => member.user?.id !== userId,
        );

        const unreadCount = allUnreadCounts[room.id] || 0;

        return {
          ...room,
          chatMembers: {
            meMember: { ...meMember, unreadCount },
            otherMembers,
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

  async getChatRoom(jwtUser: JwtUser, chatRoomId: number) {
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
      const meMember = chatRoom.chatMembers.find(
        (member) => member.user.id === userId,
      );

      // 상대방 정보 필터링
      const otherMembers = chatRoom.chatMembers.filter(
        (member) => member.user.id !== userId,
      );

      return {
        id: chatRoom.id,
        chatMembers: { meMember, otherMembers },
        lastMessage: chatRoom.lastMessage,
        createdAt: chatRoom.createdAt,
        updatedAt: chatRoom.updatedAt,
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to get chat room');
    }
  }

  async findChatRoomByUsers(
    jwtUser: JwtUser,
    findChatRoomByUsersDto: FindChatRoomByUsersDto,
  ) {
    const { id: userId } = jwtUser;
    const { opponentIds } = findChatRoomByUsersDto;
    const allUserIds = [userId, ...opponentIds];

    const chatRoom = await this.checkExistingChatRoom(allUserIds);

    if (!chatRoom) {
      return null;
    }

    // chatMembers에서 me와 others를 분리
    const meMember = chatRoom.chatMembers.find(
      (member) => member.user?.id === userId,
    );
    const otherMembers = chatRoom.chatMembers.filter(
      (member) => member.user?.id !== userId,
    );

    const modifiedChatRoom = {
      ...chatRoom,
      chatMembers: {
        meMember,
        otherMembers: otherMembers.map((member) => ({
          id: member.user.id,
          nickname: member.user.nickname,
          photo: member.user.photo,
          role: member.user.role,
        })),
      },
    };

    return modifiedChatRoom;
  }

  async getMessages(
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
    const qb = await this.messagesRepository
      .createQueryBuilder('message')
      .where('message.chatRoomId = :chatRoomId', { chatRoomId })
      .leftJoin('message.sender', 'sender')
      .addSelect([
        'sender.id',
        'sender.nickname',
        'sender.photo',
        'sender.role',
      ])
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .limit(pageSize);

    if (cursor) {
      const cursorMessage = await this.messagesRepository.findOne({
        where: { id: cursor },
        select: ['id', 'createdAt'],
      });

      if (!cursorMessage) {
        throw new NotFoundException('Cursor message not found');
      }

      // DATE_TRUNC와 보조 키로 비교
      qb.andWhere(
        new Brackets((qb) => {
          qb.where(
            `DATE_TRUNC('milliseconds', message.createdAt) < :createdAt`,
            { createdAt: cursorMessage.createdAt },
          ).orWhere(
            new Brackets((qb) => {
              qb.where(
                `DATE_TRUNC('milliseconds', message.createdAt) = :createdAt`,
                { createdAt: cursorMessage.createdAt },
              ).andWhere('message.id < :id', { id: cursorMessage.id });
            }),
          );
        }),
      );
    }

    const [messages, total] = await qb.getManyAndCount();

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
  async createMessage(jwtUser: JwtUser, createMessageDto: CreateMessageDto) {
    const { id: senderId } = jwtUser;
    const { chatRoomId, opponentIds, content } = createMessageDto;

    // 트랜잭션
    return await this.dataSource.transaction(async (manager) => {
      let chatRoom;

      // 1. 기존 채팅방이 있는 경우
      if (chatRoomId) {
        chatRoom = await manager.findOne(ChatRoom, {
          where: { id: chatRoomId },
        });
        if (!chatRoom) {
          throw new NotFoundException('No ChatRoom found');
        }
      } else if (opponentIds && opponentIds.length > 0) {
        const allUserIds = [senderId, ...opponentIds];
        const existingRoom = await this.checkExistingChatRoom(allUserIds);

        if (existingRoom) {
          chatRoom = existingRoom;
        } else {
          // 없으면 새로 생성
          chatRoom = manager.create(ChatRoom, {});
          await manager.save(chatRoom);

          const members = allUserIds.map((userId) =>
            manager.create(ChatMember, { user: { id: userId }, chatRoom }),
          );
          await manager.save(ChatMember, members);
        }
      } else {
        throw new BadRequestException(
          'Either chatRoomId or opponentIds required',
        );
      }

      // 3. 메시지 생성 및 저장
      const newMessage = this.messagesRepository.create({
        content,
        sender: { id: senderId },
        chatRoom,
      });

      const savedMessage = await manager.save(newMessage);

      // 4. chatRoom 'lastMessage' 업데이트
      chatRoom.lastMessage = savedMessage;
      await manager.save(chatRoom);

      // 5. chatMembers 조회
      const chatMembers = await manager.find(ChatMember, {
        where: { chatRoom: { id: chatRoom.id } },
        relations: ['user', 'lastReadMessage'],
        select: { user: { id: true } },
      });

      // 6. 읽음 처리 + Redis unread count 증가
      await Promise.all(
        chatMembers.map(async (member) => {
          if (!member.user) return;

          if (member.user.id === senderId) {
            member.lastReadMessage = savedMessage;

            await manager.save(ChatMember, member);
          } else {
            await this.redisChatService.incrementUnreadCount(
              member.user.id,
              chatRoom.id,
            );
          }
        }),
      );

      // 7. 메시지 최종 조회
      const fullMessage = await manager
        .getRepository(Message)
        .createQueryBuilder('message') // 여기 alias 붙여야 함!
        .leftJoin('message.sender', 'sender')
        .addSelect([
          'sender.id',
          'sender.nickname',
          'sender.photo',
          'sender.role',
        ])
        .leftJoinAndSelect('message.chatRoom', 'chatRoom')
        .where('message.id = :id', { id: savedMessage.id })
        .getOne();

      return { ...fullMessage };
    });
  }

  // 유저의 안 읽은 메시지 카운트 조회
  async getUnreadMessageCountByUser(jwtUser: JwtUser) {
    return await this.redisChatService.getTotalUnreadCount(jwtUser.id);
  }

  // 1. ChatMember(me) `lastMessage` 업데이트
  // 2. Redis unreadCount 0으로 리셋
  async markMessagesAsRead(
    jwtUser: JwtUser,
    chatRoomId: number,
    lastReadMessage: {
      lastReadMessageId: number;
      lastReadMessageCreatedAt: string;
    },
  ) {
    const { id: userId } = jwtUser;
    const { lastReadMessageId } = lastReadMessage;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. DB에 마지막으로 읽은 메시지 정보 업데이트
      const meMember = await queryRunner.manager.findOne(ChatMember, {
        where: { chatRoom: { id: chatRoomId }, user: { id: userId } },
      });

      if (!meMember) {
        throw new NotFoundException('ChatMember not found');
      }

      const message = await queryRunner.manager.findOne(Message, {
        where: {
          id: lastReadMessageId,
          // createdAt: new Date(lastReadMessageCreatedAt),
        },
      });

      if (message) {
        meMember.lastReadMessage = message;
        await queryRunner.manager.save(meMember);
      }

      await queryRunner.commitTransaction();

      // 2. Redis의 안 읽은 메시지 카운트를 0으로 리셋
      await this.redisChatService.setUnreadCount(userId, chatRoomId, 0);
    } catch (e) {
      await queryRunner.rollbackTransaction();
      // 에러 로깅 또는 구체적인 에러 처리를 여기에 추가할 수 있습니다.
      throw new InternalServerErrorException(
        'Failed to mark messages as read.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // 채팅방 속한 유저
  async getChatRoomMemberIds(chatRoomId: number) {
    // 채팅방 찾기
    const chatRoom = await this.chatRoomsRepository.findOne({
      where: { id: chatRoomId },
      relations: ['chatMembers', 'chatMembers.user'],
    });

    if (!chatRoom || !chatRoom.chatMembers) return [];

    return chatRoom.chatMembers.map((member) => member.user.id);
  }

  // 헬퍼 함수: 채팅방 여부
  async checkExistingChatRoom(memberIds: number[]) {
    const chatRoom = await this.chatRoomsRepository.findOne({
      relations: {
        lastMessage: true,
        chatMembers: { user: true },
      },
      where: {
        chatMembers: {
          user: {
            id: In(memberIds),
          },
        },
      },
      select: {
        id: true,
        lastMessage: true,
        chatMembers: {
          id: true,
          user: {
            id: true,
            role: true,
            nickname: true,
            photo: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (chatRoom?.chatMembers.length === memberIds.length) {
      return chatRoom;
    }

    return null;
  }
}
