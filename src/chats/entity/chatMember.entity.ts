import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from 'src/common/entity/core.entity';
import { User } from 'src/users/entity/user.entity';
import { ChatRoom } from './chatRoom.entity';

@Entity()
export class ChatMember extends CoreEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.chatMembers, {
    onDelete: 'CASCADE',
  })
  chatRoom: ChatRoom;

  @Column({ default: 0 })
  unreadCount: number;
}
