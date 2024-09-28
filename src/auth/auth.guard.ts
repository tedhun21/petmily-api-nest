import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { jwtConstants } from './auth.constant';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}
  // 1. 클라이언트에서 header로 jwt보냈다.
  // 2. 여기서는 request를 잡아서 header에 있는 jwt를 확인한다.
  // 3. jwt가 있으면 jwt secret으로 열어서 그 데이터를 request에 넣어서 다시 보낸다.
  // 3-1. jwt가 없으면 Unahthorized Error 발생
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // token 분리
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    // jwt 맞는지 확인 -> 맞으면 request['user']에 데이터 삽입
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });

      request['user'] = payload;
    } catch (e) {
      throw new UnauthorizedException();
    }
    return true;
  }

  // token 데이터 뽑아내는 함수
  private extractTokenFromHeader(request: Request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
