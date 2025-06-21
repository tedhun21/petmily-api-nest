import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification } from './entity/notification.entity';
import { NotificationRead } from './entity/notification_read.entity';
import { User } from 'src/users/entity/user.entity';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateNotificationDto } from './dto/create.notification.dto';
import { RedisNotificationService } from 'src/redis/notification/redis-notification.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(NotificationRead)
    private readonly notificationReadsRepository: Repository<NotificationRead>,
    private readonly dataSource: DataSource,
    private readonly redisNotificationService: RedisNotificationService,
  ) {}

  // 트랜잭션
  // 1. notification 생성
  // 2. notication_read 생성
  // 트랙잭션 후, 유저 unread count (redis) 증가
  async create(createNotificationDto: CreateNotificationDto) {
    const { senderId, receiverIds, type, metadata } = createNotificationDto;

    const notification = await this.dataSource.transaction(async (manager) => {
      const receivers = await manager
        .createQueryBuilder(User, 'user')
        .select(['user.id', 'user.nickname'])
        .whereInIds(receiverIds)
        .getMany();

      // Notification 생성
      const notification = manager.create(Notification, {
        receivers,
        senderId,
        type,
        metadata,
      });

      await manager.save(Notification, notification);

      // NotificationRead 생성 (sender + receivers)
      const notificationReads = [
        manager.create(NotificationRead, {
          notification,
          user: { id: senderId },
          isRead: true,
        }), // sender는 바로 읽음 처리
        ...receivers.map((receiver) =>
          manager.create(NotificationRead, { notification, user: receiver }),
        ),
      ];

      await manager.getRepository(NotificationRead).save(notificationReads);

      return notification;
    });

    // Redis에 sender와 receiverIds에 해당하는 각 유저들의 unread count 증가 (트랜잭션 성공 후)
    const allUserIds = [senderId, ...receiverIds];

    await Promise.all(
      allUserIds.map((id) =>
        this.redisNotificationService.incrementUnreadNotificationCount(id),
      ),
    );

    return notification;
  }

  async find(jwtUser: JwtUser, date: string, paginationDto: PaginationDto) {
    const { id: userId } = jwtUser;
    const { page, pageSize } = paginationDto;

    const limitDaysAgo = new Date(date);
    limitDaysAgo.setDate(limitDaysAgo.getDate() - 30);

    const query = this.notificationsRepository
      .createQueryBuilder('notification')
      .innerJoin(
        'notification.receivers',
        'receiver',
        'receiver.id = :userId',
        { userId },
      )
      .leftJoin(
        'notification.readStatus',
        'readStatus',
        'readStatus.userId = :userId',
        {
          userId,
        },
      )
      .addSelect(['readStatus.isRead', 'readStatus.readAt'])
      .orderBy('notification.createdAt', 'DESC')
      .skip((+page - 1) * +pageSize)
      .take(+pageSize);

    // date가 있을 때 30일 전부터 필터링
    if (date) {
      const parsedDate = new Date(date);
      parsedDate.setDate(parsedDate.getDate() - 30);
      query.andWhere('notification.createdAt >= :limitDaysAgo', {
        limitDaysAgo: parsedDate,
      });
    }

    const [notifications, total] = await query.getManyAndCount();

    const totalPages = Math.ceil(total / +pageSize);

    return {
      results: notifications,
      pagination: {
        total,
        totalPages,
        page: +page,
        pageSize: +pageSize,
      },
    };
  }

  // NotificationRead 읽음 처리
  // 트랜잭션
  // 1. notification id 배열 가지고 반복
  // 2. notification Read 찾기 (notificationId, userId) 이용해서
  // 3. redis에 캐싱된 알림에 업데이트 (캐싱된 데이터가 없으면 그냥 놔두기)
  async updateNotificationRead(
    jwtUser: JwtUser,
    body: { notificationIds: string[]; isRead: boolean },
  ) {
    const { id: userId } = jwtUser;
    const { notificationIds, isRead } = body;
    const now = new Date();

    // 몇 개가 읽음처리 됐는지 카운트
    const updatedIds: string[] = [];

    await this.dataSource.transaction(async (manager) => {
      // 트랜잭션 내에서 Repository를 manager로 직접 가져오기
      const notificationReadRepository =
        manager.getRepository(NotificationRead);

      for (const notificationId of notificationIds) {
        const notificationRead = await notificationReadRepository.findOne({
          where: {
            notification: { id: Number(notificationId) },
            user: { id: userId },
          },
        });

        if (!notificationRead) {
          throw new Error(
            `NotificationRead not found for notification ${notificationId}`,
          );
        }

        const wasRead = notificationRead.isRead;

        notificationRead.isRead = isRead;
        notificationRead.readAt = isRead ? now : null;

        const saved = await notificationReadRepository.save(notificationRead);

        if (saved.isRead && !wasRead) {
          updatedIds.push(notificationId);
        }
      }
    });

    // Redis에서 읽지 않은 알림 개수 감소
    // if (isRead && updatedIds.length > 0) {
    //   await this.redisNotificationService.decrementUnreadNotificationCount(
    //     userId,
    //     updatedIds.length,
    //   );
    // }

    return {
      message: 'Successfully read notification',
      updatedIds,
    };
  }

  // 유저의 안 읽음 알림 카운트 (자주 조회)
  // async getUnreadCount(jwtUser: JwtUser) {
  //   const { id: userId } = jwtUser;

  //   const cached =
  //     await this.redisNotificationService.getUserUnreadNotificationCount(
  //       userId,
  //     );

  //   if (cached) {
  //     return cached;
  //   }

  //   const unreadCount = await this.notificationReadsRepository.count({
  //     where: { user: { id: userId }, isRead: false },
  //   });

  //   // DB에서 가져온 unreadCount redis에 저장
  //   await this.redisNotificationService.setUserUnreadNotificationCount(
  //     userId,
  //     unreadCount,
  //   );
  //   return unreadCount;
  // }
}
