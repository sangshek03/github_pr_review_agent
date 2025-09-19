import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatSessionService } from '../services/chat-session.service';
import { WebSocketAuthGuard } from './websocket-auth.guard';
import * as jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  sessionIds?: Set<string>;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();
  private sessionRooms = new Map<string, Set<string>>(); // sessionId -> Set of socketIds

  constructor(private readonly chatSessionService: ChatSessionService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);

    try {
      // Extract user ID from handshake or token
      const userId = client.handshake.auth.token;

      if (!userId) {
        this.logger.warn(`Client ${client.id} failed authentication`);
        client.disconnect();
        return;
      }

      client.userId = userId;
      client.sessionIds = new Set();
      this.connectedClients.set(client.id, client);

      this.logger.log(`Client ${client.id} authenticated as user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Authentication failed for client ${client.id}:`,
        error,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Leave all session rooms
    if (client.sessionIds) {
      client.sessionIds.forEach((sessionId) => {
        this.leaveSessionRoom(client, sessionId);
      });
    }

    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('join_session')
  async handleJoinSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { session_id: string },
  ) {
    try {
      if (!client.userId) {
        client.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
        return;
      }

      // Verify user has access to this session
      const { session } = await this.chatSessionService.getSessionWithMessages(
        data.session_id,
        client.userId,
      );

      if (!session) {
        client.emit('error', {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        });
        return;
      }

      // Join session room
      this.joinSessionRoom(client, data.session_id);

      client.emit('session_joined', { session_id: data.session_id });
      this.logger.log(`Client ${client.id} joined session ${data.session_id}`);
    } catch (error) {
      this.logger.error(`Failed to join session:`, error);
      client.emit('error', {
        code: 'JOIN_FAILED',
        message: 'Failed to join session',
      });
    }
  }

  @SubscribeMessage('leave_session')
  handleLeaveSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { session_id: string },
  ) {
    this.leaveSessionRoom(client, data.session_id);
    client.emit('session_left', { session_id: data.session_id });
    this.logger.log(`Client ${client.id} left session ${data.session_id}`);
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { session_id: string; message: string },
  ) {
    try {
      if (!client.userId) {
        client.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
        return;
      }

      // Broadcast typing stop to session
      this.broadcastToSession(data.session_id, 'message:typing', {
        session_id: data.session_id,
        is_typing: false,
        user_id: client.userId,
      });

      // Process the message through the chat service
      this.logger.log(
        `Processing message for session ${data.session_id}: "${data.message}"`,
      );
      const response = await this.chatSessionService.askQuestion(
        data.session_id,
        client.userId,
        { question: data.message },
      );
      const answerLength =
        typeof response?.answer === 'string'
          ? response.answer.length
          : response?.answer
            ? JSON.stringify(response.answer).length
            : 0;

      this.logger.log(`Received response for session ${data.session_id}:`, {
        hasAnswer: !!response?.answer,
        answerLength: answerLength,
        answerType: typeof response?.answer,
        messageType: response?.message_type,
        contextUsed: response?.context_used?.length || 0,
      });

      // Validate response structure
      const answerContent =
        typeof response?.answer === 'string'
          ? response.answer.trim()
          : response?.answer
            ? JSON.stringify(response.answer)
            : '';

      this.logger.log('Validation check:', {
        hasResponse: !!response,
        hasAnswer: !!response?.answer,
        answerContentLength: answerContent.length,
        willPass: !(
          !response ||
          !response.answer ||
          answerContent.length === 0
        ),
      });

      if (!response || !response.answer || answerContent.length === 0) {
        this.logger.error('Response validation FAILED:', {
          hasResponse: !!response,
          hasAnswer: !!response?.answer,
          answerType: typeof response?.answer,
          answerContentLength: answerContent.length,
          answerContent: response?.answer,
        });
        client.emit('error', {
          code: 'INVALID_RESPONSE',
          message: 'Received invalid response from chat service',
        });
        return;
      }

      this.logger.log('Response validation PASSED, broadcasting message...');

      // Always convert to string format for consistent frontend handling
      const content =
        typeof response.answer === 'string'
          ? response.answer
          : JSON.stringify(response.answer, null, 2);

      // Broadcast the new message to all clients in the session
      const broadcastData = {
        message: {
          message_id: response.message_id || 'unknown',
          sender_type: 'bot',
          message_type: response.message_type || 'text',
          content: content, // Changed back to 'content' field name
          created_at: new Date(),
        },
        response_metadata: {
          context_used: response.context_used || [],
          followup_questions: response.followup_questions || [],
          confidence_score: response.confidence_score || 0.5,
        },
      };

      this.logger.log('Broadcasting message to session:', {
        sessionId: data.session_id,
        messageType: broadcastData.message.message_type,
        hasContent: !!broadcastData.message.content,
        contentLength: broadcastData.message.content?.length || 0,
      });

      this.broadcastToSession(data.session_id, 'message:new', broadcastData);

      // Update session activity
      this.broadcastToSession(data.session_id, 'session:updated', {
        session_id: data.session_id,
        last_activity: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to process message:`, error);
      client.emit('error', {
        code: 'MESSAGE_FAILED',
        message: 'Failed to process message',
      });
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { session_id: string },
  ) {
    if (!client.userId) return;

    this.broadcastToSession(
      data.session_id,
      'message:typing',
      {
        session_id: data.session_id,
        is_typing: true,
        user_id: client.userId,
      },
      [client.id],
    ); // Exclude the sender
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { session_id: string },
  ) {
    if (!client.userId) return;

    this.broadcastToSession(
      data.session_id,
      'message:typing',
      {
        session_id: data.session_id,
        is_typing: false,
        user_id: client.userId,
      },
      [client.id],
    ); // Exclude the sender
  }

  @SubscribeMessage('get_session_users')
  handleGetSessionUsers(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { session_id: string },
  ) {
    const sessionRoom = this.sessionRooms.get(data.session_id);
    const users = new Set<string>();

    if (sessionRoom) {
      sessionRoom.forEach((socketId) => {
        const socket = this.connectedClients.get(socketId);
        if (socket?.userId) {
          users.add(socket.userId);
        }
      });
    }

    client.emit('session_users', {
      session_id: data.session_id,
      user_count: users.size,
      users: Array.from(users),
    });
  }

  // Helper methods
  // private async extractUserIdFromSocket(
  //   client: AuthenticatedSocket,
  // ): Promise<string | null> {
  //   try {
  //     const token = client.handshake.auth?.token;

  //     if (!token) {
  //       this.logger.warn(`No token provided by client ${client.id}`);
  //       return null;
  //     }

  //     // ✅ Verify token with your secret
  //     const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
  //       user_id: string;
  //     };

  //     return decoded.user_id;
  //   } catch (error) {
  //     this.logger.error(
  //       `Token validation failed for client ${client.id}:`,
  //       error,
  //     );
  //     return null;
  //   }
  // }

  // private validateTokenAndGetUserId(token: string): string | null {
  //   // TODO: Implement proper JWT validation
  //   // This is a placeholder implementation
  //   // In production, you should:
  //   // 1. Verify JWT signature
  //   // 2. Check expiration
  //   // 3. Extract user ID from payload

  //   // For now, return a mock user ID for demonstration
  //   // Remove this and implement proper validation
  //   return 'mock-user-id';
  // }

  private joinSessionRoom(client: AuthenticatedSocket, sessionId: string) {
    client.join(sessionId);
    client.sessionIds?.add(sessionId);

    if (!this.sessionRooms.has(sessionId)) {
      this.sessionRooms.set(sessionId, new Set());
    }
    this.sessionRooms.get(sessionId)?.add(client.id);
  }

  private leaveSessionRoom(client: AuthenticatedSocket, sessionId: string) {
    client.leave(sessionId);
    client.sessionIds?.delete(sessionId);

    const sessionRoom = this.sessionRooms.get(sessionId);
    if (sessionRoom) {
      sessionRoom.delete(client.id);
      if (sessionRoom.size === 0) {
        this.sessionRooms.delete(sessionId);
      }
    }
  }

  private broadcastToSession(
    sessionId: string,
    event: string,
    data: any,
    excludeSocketIds: string[] = [],
  ) {
    const sessionRoom = this.sessionRooms.get(sessionId);

    this.logger.log(`Broadcasting event '${event}' to session ${sessionId}:`, {
      hasSessionRoom: !!sessionRoom,
      connectedSockets: sessionRoom?.size || 0,
      totalConnectedClients: this.connectedClients.size,
      eventType: event,
    });

    if (!sessionRoom) {
      this.logger.warn(`No session room found for session ${sessionId}`);
      return;
    }

    let messagesSent = 0;
    sessionRoom.forEach((socketId) => {
      if (!excludeSocketIds.includes(socketId)) {
        const socket = this.connectedClients.get(socketId);
        if (socket) {
          socket.emit(event, data);
          messagesSent++;
          this.logger.log(`Sent '${event}' to socket ${socketId}`);
        } else {
          this.logger.warn(`Socket ${socketId} not found in connected clients`);
        }
      }
    });

    this.logger.log(
      `Broadcast complete: sent ${messagesSent} messages for event '${event}'`,
    );
  }

  // Public method to broadcast messages from other services
  public broadcastMessageToSession(
    sessionId: string,
    event: string,
    data: any,
  ) {
    this.broadcastToSession(sessionId, event, data);
  }

  // Get connected user count for a session
  public getSessionUserCount(sessionId: string): number {
    const sessionRoom = this.sessionRooms.get(sessionId);
    return sessionRoom ? sessionRoom.size : 0;
  }

  // Get all active sessions
  public getActiveSessions(): string[] {
    return Array.from(this.sessionRooms.keys());
  }
}
