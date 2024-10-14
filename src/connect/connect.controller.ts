import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Controller('connect')
export class ConnectController {
  constructor(private readonly jwtService: JwtService) {}
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleLoginCallback(@Req() req, @Res() res) {
    const user = req.user; // Google 인증을 통해 가져온 사용자 정보

    try {
      // JWT 생성
      const token = await this.jwtService.signAsync({
        id: user.id,
        role: user.role,
      });

      const redirectURL = `${process.env.GOOGLE_FRONT_REDIRECT_URL}?access_token=${token}`;

      // 응답 반환
      return res.redirect(redirectURL);
    } catch (error) {
      console.error('Error in googleLoginCallback:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
}
