import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SignInDto } from './dto/signIn.auth.dto';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RedisAuthService } from 'src/redis/auth/redis-auth.service';
import { UserRole } from 'src/users/entity/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly redisAuthService: RedisAuthService,
    private readonly configService: ConfigService,
  ) {}

  // 이메일 로그인
  async signInWithCredentials(signInDto: SignInDto) {
    // ── 1. Redis 연결 확인 ───────────────────────────
    if (!this.redisService.getClient()) {
      throw new ServiceUnavailableException(
        'Server is temporarily unavailable. Please try again later.',
      );
    }

    const { email, password } = signInDto;

    const user = await this.usersService.validateUserByEmailAndPassword(
      email,
      password,
    );

    if (!user) {
      throw new NotFoundException('No user found');
    }

    // ── 2. 토큰 생성 및 저장 ───────────────────────────
    const payload = { id: user.id, role: user.role };
    const refresh_token = await this.loginWithUser(payload);

    return refresh_token;
  }

  // OAuth 로그인
  async signInWithOAuth(payload: { id: number; role: UserRole }) {
    const refresh_token = await this.loginWithUser(payload);

    return refresh_token;
  }

  // 공통 로그인 처리 - 토큰 발행, 리프레시 토큰
  async loginWithUser(payload: { id: number; role: UserRole }) {
    const refresh_token = await this.generateToken(payload, 'refresh');

    if (!this.redisService.getClient()) {
      throw new ServiceUnavailableException('Redis is not connected');
    }

    await this.redisAuthService.saveRefreshToken(payload.id, refresh_token);

    return refresh_token;
  }

  async refreshToken({ refreshToken }: RefreshTokenDto) {
    // ── 1. JWT 유효성 검사 (서명·만료 확인) ───────────────────────
    let decoded: { id: number; role: UserRole; exp?: number; iat?: number };

    try {
      decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // ── 2. 사용자 존재 여부 확인 ──────────────────────────────────
    const user = await this.usersService.findUserById(decoded.id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // ── 3. Redis 연결 확인 ──────────────────────────────────────
    if (!this.redisService.getClient()) {
      throw new ServiceUnavailableException('Redis is not connected');
    }

    // ── 4. Redis 토큰 일치 확인 ─────────────────────────────────
    const stored = await this.redisAuthService.getRefreshToken(decoded.id);
    console.log('Stored refresh token:', stored);
    if (!stored || stored !== refreshToken) {
      await this.redisAuthService.deleteRefreshToken(decoded.id);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // ── 5. 새 토큰 발급 및 Redis 저장 ───────────────────────────
    const cleanPayload = { id: decoded.id, role: decoded.role };

    const [access_token, newRefreshToken] = await Promise.all([
      this.generateToken(cleanPayload, 'access'),
      this.generateToken(cleanPayload, 'refresh'),
    ]);

    await this.redisAuthService.saveRefreshToken(decoded.id, newRefreshToken);

    return { access_token, refresh_token: newRefreshToken };
  }

  // async validateEmailCode(emailCodeInput) {
  //   const { code } = emailCodeInput;
  // }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(refreshToken) as { id: number };
      if (payload && payload.id) {
        await this.redisAuthService.deleteRefreshToken(payload.id);
      }
    } catch (e) {
      console.error('Logout failed:', e);
    }
  }

  private async generateToken(
    payload: { id: number; role: UserRole },
    type: 'access' | 'refresh',
  ) {
    const secret = this.configService.get<string>(
      type === 'access' ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET',
    );

    const expiresIn = type === 'access' ? '1m' : '7d';

    return this.jwtService.signAsync(payload, { secret, expiresIn });
  }
}
