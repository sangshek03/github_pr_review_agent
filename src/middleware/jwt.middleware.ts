import { ForbiddenException, Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction } from 'express';
import { Request as ExpressRequest } from 'express';
import { Response } from 'express';
import { UsersService } from '../version1/user_management/users/users.service';

export interface Request extends ExpressRequest {
  cookies: { [key: string]: any };
}

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authCookie = req.cookies?.['auth-cookie'];

    if (!authCookie) {
      return res.status(401).json({ message: 'Please login back' });
    }

    const { accessToken, refreshToken, user_id } = req.cookies['auth-cookie'];

    if (!accessToken) {
      return res.status(401).json({ message: 'No access token found' });
    }

    try {
      this.jwtService.verify(accessToken, {
        secret: process.env.JWT_ACCESS_SECRET || 'your-jwt-access-secret-key',
      });

      return next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return res.status(403).json({
          status: 403,
          message: 'You do not have permission to access this resource',
        });
      }

      if (error.name === 'TokenExpiredError') {
        if (!refreshToken) {
          return res.status(401).json({ message: 'No refresh token found' });
        }

        try {
          const user = await this.usersService.findOne(user_id);
          const isValidRefreshToken = await this.usersService.validatePassword(
            refreshToken,
            user.password || '',
          );

          if (!isValidRefreshToken) {
            return res
              .status(401)
              .json({ message: 'Refresh token expired. Please login back' });
          }

          if(!user){
             throw new NotFoundException(`User with ID ${user_id} not found`);
          }

          const tokens = await this.generateTokens(user.user_id);

          const auth_data = {
            refreshToken: tokens.refreshToken,
            accessToken: tokens.accessToken,
            user_id: user.user_id,
            user_verified: true,
          };

          res.cookie('auth-cookie', auth_data, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });

          return next();
        } catch (refreshError) {
          return res.status(401).json({ message: 'Please login back' });
        }
      } else {
        return res.status(401).json({ message: 'Invalid access token' });
      }
    }
  }

  private async generateTokens(userId: string) {
    const payload = { sub: userId, username: userId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET || 'your-jwt-access-secret-key',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret-key',
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}