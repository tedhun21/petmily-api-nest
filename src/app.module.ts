import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './users/entity/user.entity';
import { AuthModule } from './auth/auth.module';
import { PetsModule } from './pets/pets.module';
import { Pet } from './pets/entity/pet.entity';
import { UploadsModule } from './uploads/uploads.module';
import { ReservationsModule } from './reservations/reservations.module';
import { Reservation } from './reservations/entity/reservation.entity';
import { JournalsModule } from './journals/journals.module';
import { Journal } from './journals/entity/journal.entity';
import { ReviewsModule } from './reviews/reviews.module';
import { Review } from './reviews/entity/review.entity';
import { ConnectModule } from './connect/connect.module';
import { MailModule } from './mail/mail.module';
import { Verification } from './users/entity/verification.entity';
import { ChatsModule } from './chats/chats.module';
import { ChatRoom } from './chats/entity/chatRoom.entity';
import { Message } from './chats/entity/message.entity';
import { MapsModule } from './maps/maps.module';
import { SearchModule } from './search/search.module';
import { RedisModule } from './redis/redis.module';
import { ChatMember } from './chats/entity/chatMember.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/entity/notification.entity';
import { NotificationRead } from './notifications/entity/notification_read.entity';
import { KafkaModule } from './kafka/kafka.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      logging: true,
      entities: [
        User,
        Pet,
        Reservation,
        Journal,
        Review,
        Verification,
        ChatRoom,
        Message,
        ChatMember,
        Notification,
        NotificationRead,
      ],
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    PetsModule,
    UploadsModule,
    ReservationsModule,
    JournalsModule,
    ReviewsModule,
    ConnectModule,
    MailModule,
    ChatsModule,
    MapsModule,
    SearchModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
      global: true,
    }),
    RedisModule,
    KafkaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
