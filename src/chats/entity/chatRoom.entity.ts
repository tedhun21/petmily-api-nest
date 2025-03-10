import { CoreEntity } from 'src/common/entity/core.entity';
import { Entity, OneToMany } from 'typeorm';
import { Message } from './message.entity';
import { ChatMember } from './chatMember.entity';

@Entity()
export class ChatRoom extends CoreEntity {
  @OneToMany(() => ChatMember, (chatMember) => chatMember.chatRoom)
  chatMembers: ChatMember[];

  @OneToMany(() => Message, (message) => message.chatRoom, {
    onDelete: 'CASCADE',
  })
  messages: Message[];
}
