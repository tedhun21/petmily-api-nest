import {
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SignInDto } from './dto/signin.auth.dto';

import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}
  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;

    const user = await this.usersService.findByEmail(email);

    // 이메일 찾기에서 에러가 뜬 경우
    if (!user) {
      throw new NotFoundException();
    }

    // 비밀번호가 맞지 않는 경우
    const isMatch = await user.checkPassword(password);
    if (!isMatch) {
      throw new UnauthorizedException("Don't match password");
    }

    const payload = { id: user.id, email: user.email };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
