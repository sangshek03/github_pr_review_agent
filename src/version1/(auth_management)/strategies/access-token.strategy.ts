import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

type JwtPayload = {
  sub: string;
  username: string;
};

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.['auth-cookie']?.accessToken;
        },
      ]),
      secretOrKey:
        process.env.JWT_ACCESS_SECRET || 'your-jwt-access-secret-key',
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
