import { ArgumentsHost, Catch, UnauthorizedException } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(UnauthorizedException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const client: Socket = host.switchToWs().getClient();
    const callback = host.getArgByIndex(2); // ack 함수 여부 확인

    const errorResponse = {
      success: false,
      error: 'TokenExpired',
    };

    // ack 콜백 함수가 있다면 ack로 응답
    if (typeof callback === 'function') {
      callback(errorResponse);
    } else {
      // ack 콜백 함수가 없다면 'auth:expired' 이벤트 emit
      client.emit('auth:expired', {
        message: 'TokenExpired',
      });
    }
  }
}
