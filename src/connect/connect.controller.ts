import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { CookieOptions, Request, Response } from 'express';
import { AuthService } from 'src/auth/auth.service';
import { UserRole } from 'src/users/entity/user.entity';

@Controller('connect')
export class ConnectController {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  private getBaseCookieOptions(): Omit<CookieOptions, 'maxAge'> {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'prod';

    return {
      httpOnly: true, // 자바스크립트로 읽기 방지
      secure: isProduction, // https 프로토콜에서만 사용
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    };
  }

  private getCookieOptions(): CookieOptions {
    return {
      ...this.getBaseCookieOptions(),
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7일 동안 유효
    };
  }
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleLoginCallback(@Req() req: Request, @Res() res: Response) {
    const { id, role } = req.user as { id: number; role: UserRole }; // Google 인증을 통해 가져온 사용자 정보

    const payload = { id, role };

    try {
      const refresh_token = await this.authService.signInWithOAuth(payload);

      res.cookie('refresh_token', refresh_token, this.getCookieOptions());

      const redirectURL = `${process.env.GOOGLE_FRONT_REDIRECT_URL}`;

      return res.redirect(redirectURL);
    } catch (error) {
      console.error('Error in googleLoginCallback:', error);

      return res.status(500).json({ message: 'Internal server error' });
    }
  }
}
