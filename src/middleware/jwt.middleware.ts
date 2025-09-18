import { ForbiddenException, Injectable, NestMiddleware, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction } from 'express';
import { Request as ExpressRequest } from 'express';
import { Response } from 'express';
import { UsersService } from '../version1/user_management/users/users.service';

export interface Request extends ExpressRequest {
  cookies: { [key: string]: any };
  user?: any; // Add user property to request
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

    const { accessToken, refreshToken, user_id } = authCookie;

    if (!accessToken) {
      return res.status(401).json({ message: 'No access token found' });
    }

    try {
      // Verify access token
      const decoded = this.jwtService.verify(accessToken, {
        secret: process.env.JWT_ACCESS_SECRET || 'your-jwt-access-secret-key',
      });
      
      // Attach user to request for use in controllers
      req.user = decoded;
      return next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        // Handle expired access token by refreshing
        await this.handleTokenRefresh(req, res, next, refreshToken, user_id);
      } else if (error instanceof ForbiddenException) {
        return res.status(403).json({
          status: 403,
          message: 'You do not have permission to access this resource',
        });
      } else {
        return res.status(401).json({ message: 'Invalid access token' });
      }
    }
  }

  private async handleTokenRefresh(
    req: Request,
    res: Response,
    next: NextFunction,
    refreshToken: string,
    userId: string
  ) {
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token found' });
    }

    try {
      // Verify refresh token first
      const refreshDecoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret-key',
      });

      // Find user
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // IMPORTANT: You should store refresh tokens in database and validate against stored hash
      // The current approach of validating against password hash is incorrect
      
      // Generate new tokens
      const tokens = await this.generateTokens(user.user_id);

      await this.usersService.saveRefreshToken(user.user_id, tokens.refreshToken);

      // Update the auth cookie with new tokens
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

      // Attach user to request
      const accessDecoded = this.jwtService.verify(tokens.accessToken, {
        secret: process.env.JWT_ACCESS_SECRET || 'your-jwt-access-secret-key',
      });
      req.user = accessDecoded;

      return next();
    } catch (refreshError) {
      console.error('Refresh token error:', refreshError);
      
      if (refreshError.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Refresh token expired. Please login back' });
      }
      
      return res.status(401).json({ message: 'Invalid refresh token. Please login back' });
    }
  }

  private async generateTokens(userId: string) {
    const payload = { sub: userId, username: userId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET || 'your-jwt-access-secret-key',
        expiresIn: '60m',
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



