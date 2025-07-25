import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/signIn.auth.dto';
import { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private getBaseCookieOptions(): Omit<CookieOptions, 'maxAge'> {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'prod';
    console.log('isProduction:', isProduction); // <- 꼭 찍어보세요
    console.log('NODE_ENV:', this.configService.get<string>('NODE_ENV'));

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

  @Post('login') // 로그인
  async signInWithCredentials(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refresh_token =
      await this.authService.signInWithCredentials(signInDto);

    // refresh token 쿠키 설정
    res.cookie('refresh_token', refresh_token, this.getCookieOptions());
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    console.log('-----------Refresh Input------------', refreshToken);

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    try {
      // 서비스 호출
      const { access_token, refresh_token: newRefresh } =
        await this.authService.refreshToken({ refreshToken });

      // 새 refresh 토큰 쿠키로 덮어쓰기
      res.cookie('refresh_token', newRefresh, this.getCookieOptions());

      console.log('access_token', access_token);
      console.log('refresh_token', newRefresh);

      return { access_token };
    } catch (e) {
      console.error('Refresh token error:', e);

      // redis에서 refresh token 삭제
      const { refresh_token } = req.cookies;
      await this.authService.logout(refresh_token);

      // 브라우저 쿠키 삭제
      res.clearCookie('refresh_token', this.getBaseCookieOptions());
      throw e; // -> 프론트는 401 받아 재로그인 유도
    }
  }

  @Post('logout') // 로그아웃 (Refresh Token 무효화)
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    const { refresh_token } = req.cookies;

    res.clearCookie('refresh_token', this.getBaseCookieOptions());
    return await this.authService.logout(refresh_token);
  }

  // @Post('email/code')
  // verifyEmail(@Body() verifyEmailInput: VerifyEmailInput) {
  //   return this.authService.validateEmailCode(verifyEmailInput);
  // }
}
