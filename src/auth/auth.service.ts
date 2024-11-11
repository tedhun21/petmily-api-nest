import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SignInDto } from './dto/signin.auth.dto';

import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';

import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}
  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;

    try {
      const user = await this.usersService.findByEmailWithPassword(email);

      if (!user) {
        throw new NotFoundException('No user found');
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
      throw new InternalServerErrorException('Fail to sign in');
    }
  }

  async validateEmailCode(emailCodeInput) {
    const { code } = emailCodeInput;
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmailWithPassword(email);

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
