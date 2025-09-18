import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { ChatSession } from './chat-sessions/chat-sessions.entity';
import { ChatMessage } from './chat-messages/chat-messages.entity';

// Services
import { ChatSessionService } from './services/chat-session.service';
import { ChatLlmService } from './services/chat-llm.service';
import { ContextRetrievalService } from './services/context-retrieval.service';
import { QueryClassifierService } from './services/query-classifier.service';
import { ConversationContextService } from './services/conversation-context.service';
import { ResponseEvaluatorService } from './services/response-evaluator.service';
import { FallbackHandlerService } from './services/fallback-handler.service';

// Controllers and Gateways
import { ChatController } from './chat.controller';
import { ChatGateway } from './gateway/chat.gateway';

// Guards
import { WebSocketAuthGuard } from './gateway/websocket-auth.guard';

// Import entities from other modules that we need
import { User } from '../user_management/users/users.entity';
import { PrMetadata } from '../pr_management/pr-metadata/pr-metadata.entity';
import { Repository } from '../pr_management/repositories/repositories.entity';
import { PRFile } from '../pr_management/pr-files/pr-files.entity';
import { GithubPrReview } from '../pr_management/github-pr-reviews/github-pr-reviews.entity';
import { PrComment } from '../pr_management/pr-comments/pr-comments.entity';
import { PrSummary } from '../pr_management/pr-summary/pr-summary.entity';
import { PRCommit } from '../pr_management/pr-commits/pr-commits.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Chat management entities
      ChatSession,
      ChatMessage,
      // Related entities from other modules
      User,
      PrMetadata,
      Repository,
      PRFile,
      GithubPrReview,
      PrComment,
      PrSummary,
      PRCommit,
    ]),
  ],
  controllers: [ChatController],
  providers: [
    // Core services
    ChatSessionService,
    ChatLlmService,
    ContextRetrievalService,
    QueryClassifierService,
    ConversationContextService,
    ResponseEvaluatorService,
    FallbackHandlerService,
    // Gateway and guards
    ChatGateway,
    WebSocketAuthGuard,
  ],
  exports: [
    // Export services that might be needed by other modules
    ChatSessionService,
    ChatLlmService,
    ContextRetrievalService,
    ChatGateway,
  ],
})
export class ChatManagementModule {}