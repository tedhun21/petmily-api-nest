import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  id: number;
  email: string;
  iat: number;
  exp: number;
}

// requst를 잡아서 jwt user 부분만 return
export const AuthUser = createParamDecorator<JwtUser>(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
