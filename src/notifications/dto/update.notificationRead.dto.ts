import { PartialType } from '@nestjs/mapped-types';
import { NotificationRead } from '../entity/notification_read.entity';

export class UpdateNotificationReadDto extends PartialType(NotificationRead) {}
