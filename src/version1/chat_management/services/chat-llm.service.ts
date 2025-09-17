import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatLLMRequest, ChatLLMResponse, QueryType, QueryClassification } from '../types/chat.types';
import { MessageType } from '../chat-messages/chat-messages.entity';

@Injectable()
export class ChatLlmService {
  private readonly logger = new Logger(ChatLlmService.name);
  private openai: OpenAI;
  private readonly primaryModel: string = 'gpt-4o-mini';
  private readonly fallbackModel: string = 'gpt-4o';
  private readonly maxRetries: number = 3;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('config.openaiApiKey');

    if (!apiKey) {
      this.logger.warn(
        'OpenAI API key not configured. Chat LLM services will not be available.',
      );
      return;
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async processChatQuery(request: ChatLLMRequest): Promise<ChatLLMResponse> {
    if (!this.openai) {
      return this.getFallbackResponse('OpenAI API key not configured');
    }

    try {
      const prompt = this.buildChatPrompt(request);

      // Try primary model with retry logic
      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await this.callWithRetry(prompt, this.primaryModel);
      } catch (primaryError) {
        this.logger.warn(
          `Primary model ${this.primaryModel} failed, trying fallback model ${this.fallbackModel}`,
        );
        response = await this.callWithRetry(prompt, this.fallbackModel);
      }

      return this.parseOpenAIResponse(response, request.classification);
    } catch (error) {
      this.logger.error('Failed to process chat query:', error);
      return this.getFallbackResponse('Chat processing failed due to LLM service error');
    }
  }

  async classifyQuery(query: string): Promise<QueryClassification> {
    if (!this.openai) {
      return this.getFallbackClassification();
    }

    try {
      const classificationPrompt = this.buildClassificationPrompt(query);
      const response = await this.callWithRetry(classificationPrompt, this.primaryModel);

      const result = this.parseClassificationResponse(response);
      return result;
    } catch (error) {
      this.logger.error('Failed to classify query using LLM:', error);
      return this.getFallbackClassification();
    }
  }

  private async callWithRetry(
    prompt: string,
    model: string,
    attempt: number = 1
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      return await this.openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert code review assistant for GitHub Pull Requests. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });
    } catch (error) {
      if (attempt < this.maxRetries) {
        this.logger.warn(`Attempt ${attempt} failed, retrying...`, error);
        await this.delay(1000 * attempt); // Exponential backoff
        return this.callWithRetry(prompt, model, attempt + 1);
      }
      throw error;
    }
  }

  private buildChatPrompt(request: ChatLLMRequest): string {
    const { query, classification, context_data, conversation_history } = request;

    let contextSection = '';
    if (context_data) {
      contextSection = this.formatContextData(context_data, classification.primary_type);
    }

    let conversationSection = '';
    if (conversation_history && conversation_history.length > 0) {
      conversationSection = this.formatConversationHistory(conversation_history);
    }

    return `You are an expert GitHub PR analysis assistant. Answer the user's question about the pull request based on the provided context.

**User Question:** ${query}

**Query Type:** ${classification.primary_type}
**Confidence:** ${classification.confidence}

${contextSection}

${conversationSection}

**Instructions:**
1. Answer the question directly and accurately based on the provided context
2. If the question is about code, provide specific examples from the files
3. If the question is about reviews, quote relevant reviewer comments
4. If the question is about security/performance, reference the analysis results
5. Be concise but comprehensive
6. If you cannot answer from the context, say so clearly
7. Suggest 2-3 relevant follow-up questions

**Response Format:**
Respond with ONLY a valid JSON object in this exact format:
{
  "answer": "Your detailed answer here",
  "message_type": "text|code|json|markdown",
  "context_used": ["metadata", "files", "reviews"],
  "followup_questions": ["Question 1?", "Question 2?", "Question 3?"],
  "confidence_score": 0.85,
  "sources": ["PR metadata", "File: auth.ts", "Review by @username"]
}`;
  }

  private buildClassificationPrompt(query: string): string {
    return `Classify this GitHub PR-related query into the most appropriate category and determine what context is needed.

**Query:** ${query}

**Available Categories:**
- summary: General questions about what the PR does
- code: Questions about specific code changes, implementations, or files
- reviews: Questions about reviewer feedback, approvals, comments
- security: Questions about security concerns, vulnerabilities
- performance: Questions about performance issues, optimizations
- timeline: Questions about dates, when things happened
- files: Questions about what files changed, file-specific queries
- tests: Questions about testing, test coverage, test recommendations
- general: Other general questions

**Response Format:**
Respond with ONLY a valid JSON object:
{
  "primary_type": "category_name",
  "confidence": 0.85,
  "context_needed": ["metadata", "files", "reviews", "summary"],
  "specific_filters": {
    "file_names": ["auth.ts", "user.service.ts"],
    "user_mentions": ["username1", "username2"],
    "date_range": null
  }
}`;
  }

  private formatContextData(contextData: any, queryType: QueryType): string {
    let formatted = '**Available Context:**\n';

    if (contextData.metadata) {
      formatted += `\n**PR Metadata:**
- Title: ${contextData.metadata.title}
- Author: ${contextData.metadata.author?.login}
- State: ${contextData.metadata.state}
- Description: ${contextData.metadata.description?.substring(0, 300)}...
- Base Branch: ${contextData.metadata.branches?.base?.ref}
- Head Branch: ${contextData.metadata.branches?.head?.ref}
`;
    }

    if (contextData.summary) {
      formatted += `\n**AI Analysis Summary:**
- Overall Score: ${contextData.summary.overall_score}/10
- Summary: ${contextData.summary.summary}
- Issues Found: ${contextData.summary.issues_found?.join(', ')}
- Security Concerns: ${contextData.summary.security_concerns?.join(', ')}
- Performance Issues: ${contextData.summary.performance_issues?.join(', ')}
`;
    }

    if (contextData.files) {
      formatted += `\n**Files Changed (${contextData.files.total_files} files):**
`;
      contextData.files.files?.slice(0, 10).forEach((file: any) => {
        formatted += `- ${file.filename} (+${file.additions}/-${file.deletions}) [${file.change_type}]
`;
      });
    }

    if (contextData.reviews) {
      formatted += `\n**Reviews (${contextData.reviews.total_reviews} reviews):**
`;
      contextData.reviews.reviews?.slice(0, 5).forEach((review: any) => {
        formatted += `- ${review.reviewer.login}: ${review.state} - ${review.body?.substring(0, 100)}...
`;
      });
    }

    if (contextData.comments) {
      formatted += `\n**Comments (${contextData.comments.total_comments} comments):**
`;
      contextData.comments.comments?.slice(0, 5).forEach((comment: any) => {
        formatted += `- ${comment.author.login}: ${comment.body?.substring(0, 100)}...
`;
      });
    }

    if (contextData.security) {
      formatted += `\n**Security Analysis:**
- Security Score: ${contextData.security.overall_security_score}/10
- Concerns: ${contextData.security.security_concerns?.join(', ')}
`;
    }

    if (contextData.performance) {
      formatted += `\n**Performance Analysis:**
- Performance Score: ${contextData.performance.performance_score}/10
- Issues: ${contextData.performance.performance_issues?.join(', ')}
`;
    }

    return formatted;
  }

  private formatConversationHistory(history: any[]): string {
    if (history.length === 0) return '';

    let formatted = '\n**Conversation History:**\n';
    const recentHistory = history.slice(-5); // Last 5 messages

    recentHistory.forEach((message, index) => {
      const role = message.sender_type === 'user' ? 'User' : 'Assistant';
      formatted += `${role}: ${message.message_content.substring(0, 200)}${message.message_content.length > 200 ? '...' : ''}\n`;
    });

    return formatted;
  }

  private parseOpenAIResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    classification: QueryClassification
  ): ChatLLMResponse {
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsed = JSON.parse(content);

      return {
        answer: parsed.answer || 'No answer provided',
        message_type: this.validateMessageType(parsed.message_type) || MessageType.TEXT,
        context_used: Array.isArray(parsed.context_used) ? parsed.context_used : [],
        followup_questions: Array.isArray(parsed.followup_questions)
          ? parsed.followup_questions.slice(0, 3)
          : this.generateFallbackFollowups(classification.primary_type),
        confidence_score: typeof parsed.confidence_score === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence_score))
          : 0.5,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      };
    } catch (error) {
      this.logger.error('Failed to parse OpenAI chat response:', error);
      return this.getFallbackResponse('Failed to parse LLM response');
    }
  }

  private parseClassificationResponse(
    response: OpenAI.Chat.Completions.ChatCompletion
  ): QueryClassification {
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in classification response');
      }

      const parsed = JSON.parse(content);

      return {
        primary_type: this.validateQueryType(parsed.primary_type) || QueryType.GENERAL,
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
        context_needed: Array.isArray(parsed.context_needed) ? parsed.context_needed : ['metadata'],
        specific_filters: parsed.specific_filters || undefined,
      };
    } catch (error) {
      this.logger.error('Failed to parse classification response:', error);
      return this.getFallbackClassification();
    }
  }

  private validateMessageType(type: string): MessageType | null {
    const validTypes = Object.values(MessageType) as string[];
    return validTypes.includes(type) ? type as MessageType : null;
  }

  private validateQueryType(type: string): QueryType | null {
    const validTypes = Object.values(QueryType);
    return validTypes.includes(type as QueryType) ? type as QueryType : null;
  }

  private generateFallbackFollowups(queryType: QueryType): string[] {
    const fallbackMap = {
      [QueryType.SUMMARY]: [
        'What files were changed in this PR?',
        'What did reviewers say about this PR?',
        'Are there any security concerns?'
      ],
      [QueryType.CODE_ANALYSIS]: [
        'Show me the diff for a specific file',
        'What are the main code changes?',
        'Are there any performance implications?'
      ],
      [QueryType.REVIEWS]: [
        'What feedback did reviewers provide?',
        'Has this PR been approved?',
        'Are there any requested changes?'
      ],
      [QueryType.SECURITY]: [
        'What specific security issues were found?',
        'How can these security concerns be addressed?',
        'Are there any authentication-related changes?'
      ],
      [QueryType.PERFORMANCE]: [
        'What performance optimizations are recommended?',
        'Are there any bottlenecks in the code?',
        'How does this impact system performance?'
      ],
      [QueryType.FILES]: [
        'Show me the largest changes',
        'What programming languages are used?',
        'Are there any new files added?'
      ],
      [QueryType.TESTS]: [
        'What tests are recommended?',
        'Is there good test coverage?',
        'Are there any edge cases to consider?'
      ],
      [QueryType.TIMELINE]: [
        'When was this PR created?',
        'When was it last updated?',
        'What is the review timeline?'
      ],
      [QueryType.GENERAL]: [
        'What is this PR about?',
        'Who authored this PR?',
        'What is the current status?'
      ]
    };

    return fallbackMap[queryType] || fallbackMap[QueryType.GENERAL];
  }

  private getFallbackResponse(reason: string): ChatLLMResponse {
    return {
      answer: `I apologize, but I'm unable to process your request right now. ${reason}`,
      message_type: MessageType.TEXT,
      context_used: [],
      followup_questions: [
        'Could you please rephrase your question?',
        'Would you like to ask about something else?',
        'Is there specific information you need about this PR?'
      ],
      confidence_score: 0.1,
      sources: [],
    };
  }

  private getFallbackClassification(): QueryClassification {
    return {
      primary_type: QueryType.GENERAL,
      confidence: 0.5,
      context_needed: ['metadata'],
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateResponse(response: ChatLLMResponse): Promise<boolean> {
    try {
      // Basic validation checks
      if (!response.answer || response.answer.trim().length === 0) {
        return false;
      }

      if (response.confidence_score < 0 || response.confidence_score > 1) {
        return false;
      }

      if (!Array.isArray(response.context_used) || !Array.isArray(response.followup_questions)) {
        return false;
      }

      // Check for valid message type
      const validTypes = Object.values(MessageType) as string[];
      if (!validTypes.includes(response.message_type)) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Response validation failed:', error);
      return false;
    }
  }
}