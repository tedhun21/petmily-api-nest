import { CoreEntity } from 'src/common/entity/core.entity';
import { User } from 'src/users/entity/user.entity';
import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { NotificationRead } from './notification_read.entity';

export enum NotificationType {
  RESERVATION_UPDATE = 'reservation_update',
  MESSAGE = 'message',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification extends CoreEntity {
  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ nullable: true })
  senderId: number;

  @ManyToMany(() => User, (user) => user.receivedNotifications)
  @JoinTable()
  receivers: User[];

  @OneToMany(
    () => NotificationRead,
    (notificationRead) => notificationRead.notification,
    { onDelete: 'CASCADE' },
  )
  readStatus: NotificationRead[];
}
