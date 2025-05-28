import { CoreEntity } from 'src/common/entity/core.entity';
import { User } from 'src/users/entity/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { NotificationRead } from './notification_read.entity';

export enum NotificationType {
  RESERVATION_UPDATE = 'reservation_update',
  MESSAGE = 'message',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification extends CoreEntity {
  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender?: User;

  @ManyToMany(() => User, (user) => user.receivedNotifications)
  @JoinTable()
  receivers: User[];

  @OneToMany(
    () => NotificationRead,
    (notificationRead) => notificationRead.notification,
    { onDelete: 'CASCADE' },
  )
  readStatus: NotificationRead[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
