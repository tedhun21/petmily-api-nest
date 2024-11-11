import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { UserRole } from 'src/users/entity/user.entity';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly usersService: UsersService) {
    super({
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_SECRET,
      callbackURL: process.env.GOOGLE_OAUTH_CALLBACK_URL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails[0].value;
    const username = profile.displayName;
    const provider = profile.provider;

    try {
      // 유저가 이미 존재하는지 확인
      const existingUser =
        await this.usersService.findByEmailWithPassword(email);

      if (existingUser) {
        // 유저가 존재하면 반환
        done(null, existingUser);
      } else {
        // 유저가 존재하지 않으면 새로운 유저를 생성
        const newUser = await this.usersService.create({
          email,
          username,
          provider,
          verified: true,
          role: UserRole.USER, // 기본적으로 User 상태로 설정
        });

        done(null, newUser);
      }
    } catch (e) {
      done(new InternalServerErrorException(), false);
    }
  }
}
