import { CoreEntity } from 'src/common/entity/core.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { User } from 'src/users/entity/user.entity';
import { ChatRoom } from './chatRoom.entity';

@Entity()
export class Message extends CoreEntity {
  @Column()
  content: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chatRoomId' })
  chatRoom: ChatRoom;
}
