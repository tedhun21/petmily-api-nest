import { CoreEntity } from 'src/common/entity/core.entity';
import { Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
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

  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lastMessageId' })
  lastMessage?: Message;
}
