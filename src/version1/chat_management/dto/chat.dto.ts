import { IsString, IsOptional, IsUUID, IsNotEmpty, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';
import { MessageType, SenderType } from '../chat-messages/chat-messages.entity';
import { SessionType } from '../chat-sessions/chat-sessions.entity';
import { QueryClassification } from '../types/chat.types';

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  session_name?: string;

  @IsOptional()
  @IsUrl()
  pr_url?: string;

  @IsOptional()
  @IsUUID()
  repository_id?: string;
}

export class AskQuestionDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  question: string;
}

export class GetSessionsQueryDto {
  @IsOptional()
  @IsUUID()
  repository_id?: string;

  @IsOptional()
  @IsUUID()
  pr_metadata_id?: string;
}

// Response DTOs
export class ChatSessionResponseDto {
  session_id: string;
  session_name: string;
  session_type: SessionType;
  last_activity: Date;
  created_at: Date;
  updated_at: Date;
  pr_metadata?: {
    pr_metadata_id: string;
    pr_number: number;
    title: string;
    state: string;
  };
  repository?: {
    repository_id: string;
    repository_name: string;
    repository_owner: string;
  };
}

export class ChatMessageResponseDto {
  message_id: string;
  sender_type: SenderType;
  message_type: MessageType;
  message_content: string;
  context_used?: string[];
  query_classification?: string;
  response_metadata?: {
    followup_questions?: string[];
    context_sources?: string[];
    confidence_score?: number;
  };
  created_at: Date;
}

export class SessionWithMessagesResponseDto {
  session: ChatSessionResponseDto;
  messages: ChatMessageResponseDto[];
}

export class AskQuestionResponseDto {
  message_id: string;
  answer: string;
  message_type: string;
  context_used: string[];
  followup_questions: string[];
  confidence_score: number;
  query_classification: QueryClassification;
  sources: string[];
}

export class SessionAnalyticsResponseDto {
  query_types: Record<string, number>;
  context_usage: Record<string, number>;
  avg_confidence: number;
  message_count: number;
}

// Generic API Response wrapper
export class ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export class CreateSessionResponseDto extends ApiResponse<ChatSessionResponseDto> {}
export class GetSessionsResponseDto extends ApiResponse<ChatSessionResponseDto[]> {}
export class GetSessionResponseDto extends ApiResponse<SessionWithMessagesResponseDto> {}
export class AskQuestionApiResponseDto extends ApiResponse<AskQuestionResponseDto> {}
export class DeleteSessionResponseDto extends ApiResponse<null> {}
export class GetAnalyticsResponseDto extends ApiResponse<SessionAnalyticsResponseDto> {}