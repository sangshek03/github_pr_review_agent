import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSession, SessionType } from '../chat-sessions/chat-sessions.entity';
import { ChatMessage, SenderType, MessageType } from '../chat-messages/chat-messages.entity';
import { User } from '../../user_management/users/users.entity';
import { PrMetadata } from '../../pr_management/pr-metadata/pr-metadata.entity';
import { Repository as RepoEntity } from '../../pr_management/repositories/repositories.entity';
import { ChatLlmService } from './chat-llm.service';
import { ContextRetrievalService } from './context-retrieval.service';
import { QueryClassifierService } from './query-classifier.service';
import { ChatLLMRequest, QueryClassification } from '../types/chat.types';

export interface CreateSessionDto {
  session_name?: string;
  pr_url?: string;
  repository_id?: string;
}

export interface AskQuestionDto {
  question: string;
}

export interface ChatResponse {
  message_id: string;
  answer: string;
  message_type: string;
  context_used: string[];
  followup_questions: string[];
  confidence_score: number;
  query_classification: QueryClassification;
  sources: string[];
}

@Injectable()
export class ChatSessionService {
  private readonly logger = new Logger(ChatSessionService.name);

  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private chatMessageRepo: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(PrMetadata)
    private prMetadataRepo: Repository<PrMetadata>,
    @InjectRepository(RepoEntity)
    private repositoryRepo: Repository<RepoEntity>,
    private readonly chatLlmService: ChatLlmService,
    private readonly contextRetrievalService: ContextRetrievalService,
    private readonly queryClassifierService: QueryClassifierService,
  ) {}

  async createSession(
    userId: string,
    createSessionDto: CreateSessionDto
  ): Promise<ChatSession> {
    try {
      // Validate user exists
      const user = await this.userRepo.findOne({ where: { user_id: userId } });
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      let sessionType: SessionType;
      let prMetadata: PrMetadata | null = null;
      let repository: RepoEntity | null = null;
      let sessionName: string;

      if (createSessionDto.pr_url) {
        // PR-specific session
        sessionType = SessionType.PR_SPECIFIC;
        prMetadata = await this.findPrMetadataByUrl(createSessionDto.pr_url);

        if (!prMetadata) {
          throw new HttpException(
            'PR not found. Please fetch and save the PR details first.',
            HttpStatus.NOT_FOUND
          );
        }

        sessionName = createSessionDto.session_name ||
          `Chat about PR #${prMetadata.pr_number}: ${prMetadata.title.substring(0, 50)}...`;

        repository = prMetadata.repository;
      } else if (createSessionDto.repository_id) {
        // Repository-wide session
        sessionType = SessionType.REPOSITORY_WIDE;
        repository = await this.repositoryRepo.findOne({
          where: { repository_id: createSessionDto.repository_id }
        });

        if (!repository) {
          throw new HttpException('Repository not found', HttpStatus.NOT_FOUND);
        }

        sessionName = createSessionDto.session_name ||
          `Chat about ${repository.repository_owner}/${repository.repository_name}`;
      } else {
        throw new HttpException(
          'Either pr_url or repository_id must be provided',
          HttpStatus.BAD_REQUEST
        );
      }

      // Create the chat session
      const chatSession = this.chatSessionRepo.create({
        session_name: sessionName,
        session_type: sessionType,
        user,
        prMetadata: prMetadata || undefined,
        repository: repository || undefined,
        last_activity: new Date(),
      });

      const savedSession = await this.chatSessionRepo.save(chatSession);

      this.logger.log(`Created chat session ${savedSession.session_id} for user ${userId}`);
      return savedSession;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to create chat session:', error);
      throw new HttpException(
        'Failed to create chat session',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getUserSessions(
    userId: string,
    repositoryId?: string,
    prMetadataId?: string
  ): Promise<ChatSession[]> {
    try {
      const queryBuilder = this.chatSessionRepo.createQueryBuilder('session')
        .leftJoinAndSelect('session.prMetadata', 'prMetadata')
        .leftJoinAndSelect('session.repository', 'repository')
        .leftJoinAndSelect('session.user', 'user')
        .where('session.user.user_id = :userId', { userId })
        .orderBy('session.last_activity', 'DESC');

      if (repositoryId) {
        queryBuilder.andWhere('session.repository.repository_id = :repositoryId', { repositoryId });
      }

      if (prMetadataId) {
        queryBuilder.andWhere('session.prMetadata.pr_metadata_id = :prMetadataId', { prMetadataId });
      }

      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error(`Failed to get user sessions for user ${userId}:`, error);
      throw new HttpException(
        'Failed to get user sessions',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getSessionWithMessages(sessionId: string, userId: string): Promise<{
    session: ChatSession;
    messages: ChatMessage[];
  }> {
    try {
      const session = await this.chatSessionRepo.findOne({
        where: {
          session_id: sessionId,
          user: { user_id: userId }
        },
        relations: ['prMetadata', 'repository', 'user']
      });

      if (!session) {
        throw new HttpException('Chat session not found', HttpStatus.NOT_FOUND);
      }

      const messages = await this.chatMessageRepo.find({
        where: { chatSession: { session_id: sessionId } },
        order: { created_at: 'ASC' }
      });

      return { session, messages };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to get session ${sessionId}:`, error);
      throw new HttpException(
        'Failed to get session',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async askQuestion(
    sessionId: string,
    userId: string,
    askQuestionDto: AskQuestionDto
  ): Promise<ChatResponse> {
    try {
      // Validate session belongs to user
      const session = await this.chatSessionRepo.findOne({
        where: {
          session_id: sessionId,
          user: { user_id: userId }
        },
        relations: ['prMetadata', 'repository', 'user']
      });

      if (!session) {
        throw new HttpException('Chat session not found', HttpStatus.NOT_FOUND);
      }

      // Save user message
      const userMessage = await this.saveMessage(
        session,
        SenderType.USER,
        MessageType.TEXT,
        askQuestionDto.question
      );

      // Classify the query
      let classification: QueryClassification;
      try {
        // Try rule-based classification first
        classification = this.queryClassifierService.classifyQueryRuleBased(askQuestionDto.question) ||
          await this.queryClassifierService.classifyQuery(askQuestionDto.question);
      } catch (classificationError) {
        this.logger.warn('Classification failed, using LLM fallback:', classificationError);
        classification = await this.chatLlmService.classifyQuery(askQuestionDto.question);
      }

      // Get relevant context
      const { context_data, context_sources } = await this.contextRetrievalService.getContextForQuery(
        classification,
        sessionId
      );

      // Get conversation history
      const conversationHistory = await this.getRecentConversationHistory(sessionId);

      // Prepare LLM request
      const llmRequest: ChatLLMRequest = {
        query: askQuestionDto.question,
        classification,
        context_data,
        conversation_history: conversationHistory,
        pr_context: session.prMetadata,
        repository_context: session.repository,
      };

      // Process query with LLM
      const llmResponse = await this.chatLlmService.processChatQuery(llmRequest);

      // Save bot response
      const botMessage = await this.saveMessage(
        session,
        SenderType.BOT,
        llmResponse.message_type as MessageType,
        llmResponse.answer,
        llmResponse.context_used,
        classification.primary_type,
        {
          followup_questions: llmResponse.followup_questions,
          context_sources: context_sources,
          confidence_score: llmResponse.confidence_score,
        }
      );

      // Update session activity
      await this.updateSessionActivity(sessionId);

      // Return response
      return {
        message_id: botMessage.message_id,
        answer: llmResponse.answer,
        message_type: llmResponse.message_type,
        context_used: llmResponse.context_used,
        followup_questions: llmResponse.followup_questions,
        confidence_score: llmResponse.confidence_score,
        query_classification: classification,
        sources: llmResponse.sources,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to process question in session ${sessionId}:`, error);
      throw new HttpException(
        'Failed to process question',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    try {
      const session = await this.chatSessionRepo.findOne({
        where: {
          session_id: sessionId,
          user: { user_id: userId }
        }
      });

      if (!session) {
        throw new HttpException('Chat session not found', HttpStatus.NOT_FOUND);
      }

      await this.chatSessionRepo.softDelete(sessionId);
      this.logger.log(`Deleted chat session ${sessionId} for user ${userId}`);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to delete session ${sessionId}:`, error);
      throw new HttpException(
        'Failed to delete session',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async findPrMetadataByUrl(prUrl: string): Promise<PrMetadata | null> {
    try {
      // Parse PR URL to extract owner, repo, and PR number
      const match = prUrl.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)$/);
      if (!match) {
        throw new HttpException('Invalid GitHub PR URL format', HttpStatus.BAD_REQUEST);
      }

      const [, owner, repo, prNumber] = match;

      // Find PR by repository and PR number
      return await this.prMetadataRepo.findOne({
        where: {
          pr_number: parseInt(prNumber),
          repository: {
            repository_owner: owner,
            repository_name: repo,
          }
        },
        relations: ['repository']
      });
    } catch (error) {
      this.logger.error('Failed to find PR metadata by URL:', error);
      return null;
    }
  }

  private async saveMessage(
    session: ChatSession,
    senderType: SenderType,
    messageType: MessageType,
    content: string,
    contextUsed?: string[],
    queryClassification?: string,
    responseMetadata?: any
  ): Promise<ChatMessage> {
    const messageData: Partial<ChatMessage> = {
      chatSession: session,
      sender_type: senderType,
      message_type: messageType,
      message_content: content,
      context_used: contextUsed || undefined,
      query_classification: queryClassification || undefined,
      response_metadata: responseMetadata || undefined,
    };

    const message = this.chatMessageRepo.create(messageData);

    return await this.chatMessageRepo.save(message);
  }

  private async getRecentConversationHistory(
    sessionId: string,
    limit: number = 10
  ): Promise<ChatMessage[]> {
    return await this.chatMessageRepo.find({
      where: { chatSession: { session_id: sessionId } },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    await this.chatSessionRepo.update(sessionId, {
      last_activity: new Date(),
    });
  }

  // Analytics methods
  async getSessionAnalytics(sessionId: string, userId: string): Promise<{
    query_types: Record<string, number>;
    context_usage: Record<string, number>;
    avg_confidence: number;
    message_count: number;
  }> {
    try {
      const session = await this.chatSessionRepo.findOne({
        where: {
          session_id: sessionId,
          user: { user_id: userId }
        }
      });

      if (!session) {
        throw new HttpException('Chat session not found', HttpStatus.NOT_FOUND);
      }

      const messages = await this.chatMessageRepo.find({
        where: {
          chatSession: { session_id: sessionId },
          sender_type: SenderType.BOT
        }
      });

      const queryTypes: Record<string, number> = {};
      const contextUsage: Record<string, number> = {};
      let totalConfidence = 0;
      let confidenceCount = 0;

      messages.forEach(message => {
        if (message.query_classification) {
          queryTypes[message.query_classification] = (queryTypes[message.query_classification] || 0) + 1;
        }

        if (message.context_used) {
          message.context_used.forEach(context => {
            contextUsage[context] = (contextUsage[context] || 0) + 1;
          });
        }

        if (message.response_metadata?.confidence_score) {
          totalConfidence += message.response_metadata.confidence_score;
          confidenceCount++;
        }
      });

      return {
        query_types: queryTypes,
        context_usage: contextUsage,
        avg_confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        message_count: messages.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to get session analytics for ${sessionId}:`, error);
      throw new HttpException(
        'Failed to get session analytics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}