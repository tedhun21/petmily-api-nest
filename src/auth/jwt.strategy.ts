import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ExtractJwt } from 'passport-jwt';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';

// 1. AuthGurad('jwt') 실행
// 2. JWT 추출 - Reqeust의 Authorization 헤더에서 Bearer 토큰을 추출
// 3. JWT 검증 - 생성자에서 제공된 secret 키로 토큰의 서명을 검증
// 4. validate 함수 호출 - JWT 검증이 성공적으로 끝나면, Passport는 토큰의 payload를 인자로 이 함수를 호출
// 5. 사용자 확인
// 6. request.user에 할당 - 리턴값은 NestJS에 의해 자동으로 Request 객체의 user 속성에 할당
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    super({
      // Authorization 헤더에서 Bearer 토큰 추출
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findUserById(payload.id); // payload에서 id로 사용자 검증

    if (!user) {
      throw new UnauthorizedException();
    }

    return { id: user.id, role: user.role }; // 사용자 반환
  }
}
