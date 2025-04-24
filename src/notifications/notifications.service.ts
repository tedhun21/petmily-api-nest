import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification, NotificationType } from './entity/notification.entity';
import { NotificationRead } from './entity/notification_read.entity';
import { User } from 'src/users/entity/user.entity';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(NotificationRead)
    private readonly notificationReadsRepository: Repository<NotificationRead>,
    private readonly dataSource: DataSource,
  ) {}

  // notification 생성 & notication_read 생성
  async create(payload: {
    reservationId: number;
    sender: { id: number; nickname: string };
    receiverIds: number[];
    eventType: NotificationType;
    status: string;
  }) {
    let message = '';

    switch (payload.eventType) {
      case NotificationType.RESERVATION_UPDATE:
        message = `예약번호 ${payload.reservationId} 예약이 ${payload.status} 상태로 변경됐습니다.`;
        break;
    }

    return await this.dataSource.transaction(async (manager) => {
      const receivers = await manager
        .createQueryBuilder(User, 'user')
        .select(['user.id', 'user.nickname'])
        .whereInIds(payload.receiverIds)
        .getMany();

      // Notification 생성
      const notification = manager.create(Notification, {
        receivers,
        senderId: payload.sender.id,
        type: payload.eventType,
        message,
      });

      await manager.save(Notification, notification);

      // NotificationRead 생성
      const notificationReads = receivers.map((receiver) =>
        manager.create(NotificationRead, { notification, user: receiver }),
      );

      await manager.getRepository(NotificationRead).save(notificationReads);

      return notification;
    });
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
  async updateNotificationRead(
    jwtUser: JwtUser,
    body: { notificationIds: string[]; isRead: boolean },
  ) {
    const { id: userId } = jwtUser;
    const { notificationIds, isRead } = body;

    const now = new Date();
    const results = [];

    for (const notificationId of notificationIds) {
      try {
        const notificationRead = await this.notificationReadsRepository.findOne(
          {
            where: {
              notification: { id: Number(notificationId) },
              user: { id: userId },
            },
          },
        );

        if (!notificationRead) {
          results.push({
            id: notificationId,
            success: false,
            reason: 'Notification read record not found',
          });
          continue;
        }

        const updateData: any = { isRead };
        if (isRead) {
          updateData.readAt = now;
        }

        await this.notificationReadsRepository.update(
          { id: notificationRead.id },
          updateData,
        );

        results.push({ id: notificationId, success: true });
      } catch (e) {
        results.push({
          id: notificationId,
          success: false,
          reason: 'Unexpected error occurred',
        });
      }
    }

    return {
      message: 'Processed notification read status updates',
      results,
    };
  }
}
