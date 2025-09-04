import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth?.access_token;

    try {
      const decoded = await this.jwtService.verifyAsync(token);
      client.data.user = decoded;
      return true;
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        client.emit('auth:expired', { message: 'Token expired' });
      }
      return false;
    }
  }
}
