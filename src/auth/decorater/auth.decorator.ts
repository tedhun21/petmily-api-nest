import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from 'src/users/entity/user.entity';

export interface JwtUser {
  id: number;
  role: UserRole;
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
