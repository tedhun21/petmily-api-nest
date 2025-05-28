import { Module } from '@nestjs/common';
import { ChatsGateWay } from './chats.gateway';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoom } from './entity/chatRoom.entity';
import { Message } from './entity/message.entity';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { ChatMember } from './entity/chatMember.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, Message, ChatMember]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // 환경 변수에서 비밀 키 가져오기
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
  ],
  providers: [ChatsGateWay, ChatsService],
  controllers: [ChatsController],
})
export class ChatsModule {}
