import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.['auth-cookie']?.refreshToken;
        },
      ]),
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret-key',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    const refreshToken = req?.cookies?.['auth-cookie']?.refreshToken;
    return { ...payload, refreshToken };
  }
}