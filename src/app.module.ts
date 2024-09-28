import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from './users/entity/user.entity';
import { AuthModule } from './auth/auth.module';
import { PetsModule } from './pets/pets.module';
import { Pet } from './pets/entity/pet.entity';
import { UploadsModule } from './uploads/uploads.module';
import { ReservationsModule } from './reservations/reservations.module';
import { Reservation } from './reservations/entity/reservation.entity';
import { JournalsModule } from './journals/journals.module';
import { Journal } from './journals/entity/journal.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      logging: true,
      entities: [User, Pet, Reservation, Journal],
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    PetsModule,
    UploadsModule,
    ReservationsModule,
    JournalsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
