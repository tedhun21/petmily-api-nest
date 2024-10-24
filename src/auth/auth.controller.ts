import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/signin.auth.dto';
import { VerifyEmailInput } from './dto/verify-email.auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Post('email/code')
  verifyEmail(@Body() verifyEmailInput: VerifyEmailInput) {
    return this.authService.validateEmailCode(verifyEmailInput);
  }
}
