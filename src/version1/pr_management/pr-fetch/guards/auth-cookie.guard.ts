import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthCookieGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authCookie = request.cookies?.['auth-cookie'];

    if (!authCookie) {
      throw new UnauthorizedException('Authentication cookie not found');
    }

    const { accessToken, user_id } = authCookie;

    if (!accessToken || !user_id) {
      throw new UnauthorizedException('Invalid authentication data');
    }

    try {
      this.jwtService.verify(accessToken, {
        secret: process.env.JWT_ACCESS_SECRET || 'your-jwt-access-secret-key',
      });
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
