import { CoreEntity } from 'src/common/entity/core.entity';
import { User } from 'src/users/entity/user.entity';
import { Column, Entity, ManyToOne } from 'typeorm';
import { Notification } from './notification.entity';

@Entity('notification_reads')
export class NotificationRead extends CoreEntity {
  @ManyToOne(() => Notification, (notification) => notification.readStatus, {
    onDelete: 'CASCADE',
  })
  notification: Notification;

  @ManyToOne(() => User, (user) => user.notificationReads, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;
}
