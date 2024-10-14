import {
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

    try {
      const user = await this.usersService.findByEmail(email);

      if (!user) {
        throw new NotFoundException();
      }

      const isMatch = await user.checkPassword(password);
      if (!isMatch) {
        throw new UnauthorizedException("Don't match password");
      }

      const payload = { id: user.id, role: user.role };
      return {
        access_token: await this.jwtService.signAsync(payload),
      };
    } catch (error) {
      console.error('Error in signIn:', error);
      throw error;
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (user) {
      const ok = await user.checkPassword(password);
      if (ok) {
        const { password, ...result } = user;
        return result;
      }
    }

    return null;
  }
}
