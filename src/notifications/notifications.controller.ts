import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';

import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsGateway: NotificationsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  // 카프카 예약 업데이트
  @EventPattern('reservation-update')
  async handleReservationUpdate(@Payload() payload: any) {
    // 알림 생성
    const newNotification = await this.notificationsService.create(payload);

    console.log('event_pattern_newNotification', newNotification);

    const { receivers, ...notificationWithoutReceivers } = newNotification;

    const socketPayload = {
      ...notificationWithoutReceivers,
      readStatus: receivers.map((receiver) => ({
        id: receiver.id,
        isRead: false,
        readAt: null,
      })),
    };

    // 웹소켓 유저한테 알림 보내기
    this.notificationsGateway.sendNotificationsToUsers(
      payload.receiverIds,
      socketPayload,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  find(
    @AuthUser() jwtUser: JwtUser,
    @Query('date') date: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.notificationsService.find(jwtUser, date, paginationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('read')
  updateNotificationReads(@AuthUser() jwtUser: JwtUser, @Body() body) {
    return this.notificationsService.updateNotificationRead(jwtUser, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unreadCount')
  getUnreadCount(@AuthUser() jwtUser: JwtUser) {
    return this.notificationsService.getUnreadCount(jwtUser);
  }
}
