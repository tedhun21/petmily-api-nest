import { CoreEntity } from 'src/common/entity/core.entity';
import { User } from 'src/users/entity/user.entity';
import { Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Message } from './message.entity';

@Entity()
export class ChatRoom extends CoreEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'clientId' })
  client: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'petsitterId' })
  petsitter: User;

  @OneToMany(() => Message, (message) => message.chatRoom)
  messages?: Message[];
}
