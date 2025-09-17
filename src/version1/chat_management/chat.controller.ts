import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ChatSessionService } from './services/chat-session.service';
import { AuthCookieGuard } from '../pr_management/pr-fetch/guards/auth-cookie.guard';
import { CurrentUser } from '../pr_management/pr-fetch/decorators/current-user.decorator';
import {
  CreateSessionDto,
  AskQuestionDto,
  GetSessionsQueryDto,
  CreateSessionResponseDto,
  GetSessionsResponseDto,
  GetSessionResponseDto,
  AskQuestionApiResponseDto,
  DeleteSessionResponseDto,
  GetAnalyticsResponseDto,
  ChatSessionResponseDto,
  SessionWithMessagesResponseDto,
  ChatMessageResponseDto,
} from './dto/chat.dto';

@Controller('chatbot')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(AuthCookieGuard)
export class ChatController {
  constructor(private readonly chatSessionService: ChatSessionService) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Body(ValidationPipe) createSessionDto: CreateSessionDto,
    @CurrentUser() user: { user_id: string },
  ): Promise<CreateSessionResponseDto> {
    try {
      const session = await this.chatSessionService.createSession(
        user.user_id,
        createSessionDto
      );

      const responseData: ChatSessionResponseDto = {
        session_id: session.session_id,
        session_name: session.session_name,
        session_type: session.session_type,
        last_activity: session.last_activity,
        created_at: session.created_at,
        updated_at: session.updated_at,
        pr_metadata: session.prMetadata ? {
          pr_metadata_id: session.prMetadata.pr_metadata_id,
          pr_number: session.prMetadata.pr_number,
          title: session.prMetadata.title,
          state: session.prMetadata.state,
        } : undefined,
        repository: session.repository ? {
          repository_id: session.repository.repository_id,
          repository_name: session.repository.repository_name,
          repository_owner: session.repository.repository_owner,
        } : undefined,
      };

      return {
        success: true,
        message: 'Chat session created successfully',
        data: responseData,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  async getUserSessions(
    @Query(ValidationPipe) query: GetSessionsQueryDto,
    @CurrentUser() user: { user_id: string },
  ): Promise<GetSessionsResponseDto> {
    try {
      const sessions = await this.chatSessionService.getUserSessions(
        user.user_id,
        query.repository_id,
        query.pr_metadata_id
      );

      const responseData: ChatSessionResponseDto[] = sessions.map(session => ({
        session_id: session.session_id,
        session_name: session.session_name,
        session_type: session.session_type,
        last_activity: session.last_activity,
        created_at: session.created_at,
        updated_at: session.updated_at,
        pr_metadata: session.prMetadata ? {
          pr_metadata_id: session.prMetadata.pr_metadata_id,
          pr_number: session.prMetadata.pr_number,
          title: session.prMetadata.title,
          state: session.prMetadata.state,
        } : undefined,
        repository: session.repository ? {
          repository_id: session.repository.repository_id,
          repository_name: session.repository.repository_name,
          repository_owner: session.repository.repository_owner,
        } : undefined,
      }));

      return {
        success: true,
        message: `Retrieved ${sessions.length} chat sessions successfully`,
        data: responseData,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async getSessionWithMessages(
    @Param('id') sessionId: string,
    @CurrentUser() user: { user_id: string },
  ): Promise<GetSessionResponseDto> {
    try {
      const { session, messages } = await this.chatSessionService.getSessionWithMessages(
        sessionId,
        user.user_id
      );

      const sessionData: ChatSessionResponseDto = {
        session_id: session.session_id,
        session_name: session.session_name,
        session_type: session.session_type,
        last_activity: session.last_activity,
        created_at: session.created_at,
        updated_at: session.updated_at,
        pr_metadata: session.prMetadata ? {
          pr_metadata_id: session.prMetadata.pr_metadata_id,
          pr_number: session.prMetadata.pr_number,
          title: session.prMetadata.title,
          state: session.prMetadata.state,
        } : undefined,
        repository: session.repository ? {
          repository_id: session.repository.repository_id,
          repository_name: session.repository.repository_name,
          repository_owner: session.repository.repository_owner,
        } : undefined,
      };

      const messagesData: ChatMessageResponseDto[] = messages.map(message => ({
        message_id: message.message_id,
        sender_type: message.sender_type,
        message_type: message.message_type,
        message_content: message.message_content,
        context_used: message.context_used || undefined,
        query_classification: message.query_classification || undefined,
        response_metadata: message.response_metadata || undefined,
        created_at: message.created_at,
      }));

      const responseData: SessionWithMessagesResponseDto = {
        session: sessionData,
        messages: messagesData,
      };

      return {
        success: true,
        message: 'Session and messages retrieved successfully',
        data: responseData,
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('sessions/:id/ask')
  @HttpCode(HttpStatus.OK)
  async askQuestion(
    @Param('id') sessionId: string,
    @Body(ValidationPipe) askQuestionDto: AskQuestionDto,
    @CurrentUser() user: { user_id: string },
  ): Promise<AskQuestionApiResponseDto> {
    try {
      const response = await this.chatSessionService.askQuestion(
        sessionId,
        user.user_id,
        askQuestionDto
      );

      return {
        success: true,
        message: 'Question processed successfully',
        data: response,
      };
    } catch (error) {
      throw error;
    }
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: { user_id: string },
  ): Promise<DeleteSessionResponseDto> {
    try {
      await this.chatSessionService.deleteSession(sessionId, user.user_id);

      return {
        success: true,
        message: 'Chat session deleted successfully',
        data: null,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('analytics/sessions/:id')
  @HttpCode(HttpStatus.OK)
  async getSessionAnalytics(
    @Param('id') sessionId: string,
    @CurrentUser() user: { user_id: string },
  ): Promise<GetAnalyticsResponseDto> {
    try {
      const analytics = await this.chatSessionService.getSessionAnalytics(
        sessionId,
        user.user_id
      );

      return {
        success: true,
        message: 'Session analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      throw error;
    }
  }
}