import { Module } from '@nestjs/common';
import { ChatsGateWay } from './chats.gateway';
import { UsersModule } from 'src/users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoom } from './entity/chatRoom.entity';
import { Message } from './entity/message.entity';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { ChatMember } from './entity/chatMember.entity';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, Message, ChatMember]),
    UsersModule,
    RedisModule,
  ],
  providers: [ChatsGateWay, ChatsService],
  controllers: [ChatsController],
})
export class ChatsModule {}
