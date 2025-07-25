import { Module } from '@nestjs/common';
import { ConnectController } from './connect.controller';
import { UsersModule } from 'src/users/users.module';
import { GoogleStrategy } from './google.strategy';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from 'src/auth/auth.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [UsersModule, PassportModule, AuthModule, RedisModule],
  controllers: [ConnectController],
  providers: [GoogleStrategy],
})
export class ConnectModule {}
