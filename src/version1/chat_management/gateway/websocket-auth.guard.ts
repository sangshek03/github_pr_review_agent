import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    try {
      const client: Socket = context.switchToWs().getClient();

      // Extract token from handshake
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn(`WebSocket connection rejected: No token provided`);
        throw new WsException('Authentication required');
      }

      // Validate token (implement your JWT validation logic here)
      const isValid = this.validateToken(token);

      if (!isValid) {
        this.logger.warn(`WebSocket connection rejected: Invalid token`);
        throw new WsException('Invalid authentication token');
      }

      return true;
    } catch (error) {
      this.logger.error('WebSocket authentication failed:', error);
      throw new WsException('Authentication failed');
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Try multiple sources for the token
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check auth object
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    // Check cookies
    const cookies = client.handshake.headers.cookie;
    if (cookies) {
      const tokenMatch = cookies.match(/auth-token=([^;]+)/);
      if (tokenMatch) {
        return tokenMatch[1];
      }
    }

    // Check query parameters
    if (client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }

    return null;
  }

  private validateToken(token: string): boolean {
    // TODO: Implement proper JWT validation
    // This is a placeholder implementation
    // In production, you should:
    // 1. Verify JWT signature
    // 2. Check expiration
    // 3. Validate issuer and audience
    // 4. Check token blacklist if applicable

    // For development, return true
    // Replace with actual JWT validation
    return token.length > 0;
  }
}