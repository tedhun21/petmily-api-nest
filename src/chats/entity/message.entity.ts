import { CoreEntity } from 'src/common/entity/core.entity';
import { Column, Entity, ManyToOne } from 'typeorm';

import { User } from 'src/users/entity/user.entity';
import { ChatRoom } from './chatRoom.entity';

@Entity()
export class Message extends CoreEntity {
  @Column()
  content: string;

  @ManyToOne(() => User)
  sender: User;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.messages)
  chatRoom: ChatRoom;
}
