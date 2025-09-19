import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const authCookie = request.cookies?.['auth-cookie'];

    if (!authCookie) {
      return null;
    }

    return {
      user_id: authCookie.user_id,
      accessToken: authCookie.accessToken,
      refreshToken: authCookie.refreshToken,
    };
  },
);
