import { CoreEntity } from 'src/common/entity/core.entity';
import { Column, Entity, OneToMany } from 'typeorm';
import { Message } from './message.entity';
import { ChatMember } from './chatMember.entity';

export interface ILastMessageInfo {
  id: number;
  content: string;
  createdAt: Date;
  senderId: number;
  senderNickName?: string;
  type?: string;
}

@Entity()
export class ChatRoom extends CoreEntity {
  @OneToMany(() => ChatMember, (chatMember) => chatMember.chatRoom)
  chatMembers: ChatMember[];

  @OneToMany(() => Message, (message) => message.chatRoom, {
    onDelete: 'CASCADE',
  })
  messages: Message[];

  @Column({ type: 'jsonb', nullable: true })
  lastMessage?: ILastMessageInfo;
}
