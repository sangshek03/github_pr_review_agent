import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ChatLLMRequest,
  ChatLLMResponse,
  QueryType,
  QueryClassification,
} from '../types/chat.types';
import { MessageType } from '../chat-messages/chat-messages.entity';
import { ConversationContextService } from './conversation-context.service';

@Injectable()
export class ChatLlmService {
  private readonly logger = new Logger(ChatLlmService.name);
  private openai: OpenAI;
  private readonly primaryModel: string = 'gpt-4o-mini';
  private readonly fallbackModel: string = 'gpt-4o';
  private readonly maxRetries: number = 3;
  private readonly enableConversationContext: boolean = false; // Set to false to disable context temporarily

  constructor(
    private readonly configService: ConfigService,
    private readonly conversationContextService: ConversationContextService,
  ) {
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

  async processChatQuery(
    request: ChatLLMRequest,
    sessionId?: string,
  ): Promise<ChatLLMResponse> {
    if (!this.openai) {
      return this.getFallbackResponse('OpenAI API key not configured');
    }

    try {
      const prompt = this.buildChatPrompt(request, sessionId);
      this.logger.log(
        'Generated prompt for OpenAI:',
        prompt.substring(0, 500) + '...',
      );

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

      const parsedResponse = this.parseOpenAIResponse(
        response,
        request.classification,
        sessionId,
        request.context_data,
      );

      // Update conversation context after processing
      if (
        this.enableConversationContext &&
        sessionId &&
        parsedResponse.answer
      ) {
        try {
          this.conversationContextService.updateConversationState(
            sessionId,
            request.query,
            request.classification,
            parsedResponse.answer,
            parsedResponse.context_used,
          );
        } catch (contextError) {
          this.logger.warn(
            'Failed to update conversation context:',
            contextError,
          );
          // Continue without context update - don't break the response
        }
      }

      return parsedResponse;
    } catch (error) {
      this.logger.error('Failed to process chat query:', error);
      return this.getFallbackResponse(
        'Chat processing failed due to LLM service error',
      );
    }
  }

  async classifyQuery(query: string): Promise<QueryClassification> {
    if (!this.openai) {
      return this.getFallbackClassification();
    }

    try {
      const classificationPrompt = this.buildClassificationPrompt(query);
      const response = await this.callWithRetry(
        classificationPrompt,
        this.primaryModel,
      );

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
    attempt: number = 1,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      return await this.openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert code review assistant for GitHub Pull Requests. Always respond with valid JSON only.',
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

  private buildChatPrompt(request: ChatLLMRequest, sessionId?: string): string {
    const { query, classification, context_data, conversation_history } =
      request;

    let contextSection = '';
    if (context_data) {
      contextSection = this.formatContextData(
        context_data,
        classification.primary_type,
      );
    }

    let conversationSection = '';
    if (conversation_history && conversation_history.length > 0) {
      conversationSection =
        this.formatConversationHistory(conversation_history);
    }

    // Add conversation context enhancement
    let conversationContextSection = '';
    if (this.enableConversationContext && sessionId) {
      try {
        conversationContextSection =
          this.conversationContextService.generateContextualPromptEnhancement(
            sessionId,
            query,
          );
      } catch (contextError) {
        this.logger.warn(
          'Failed to generate conversation context enhancement:',
          contextError,
        );
        conversationContextSection = '';
      }
    }

    // Enhanced security analysis instructions
    let securityInstructions = '';
    if (classification.primary_type === QueryType.SECURITY) {
      securityInstructions =
        this.buildSecurityAnalysisInstructions(context_data);
    }

    // Enhanced code analysis instructions
    let codeAnalysisInstructions = '';
    if (classification.primary_type === QueryType.CODE_ANALYSIS) {
      codeAnalysisInstructions =
        this.buildCodeAnalysisInstructions(context_data);
    }

    return `You are an expert GitHub PR analysis assistant. Answer the user's question about the pull request based on the provided context.

**User Question:** ${query}

**Query Type:** ${classification.primary_type}
**Confidence:** ${classification.confidence}

${contextSection}

${conversationSection}

${conversationContextSection}

${securityInstructions}

${codeAnalysisInstructions}

**Enhanced Instructions:**
1. Answer the question directly and accurately based on the provided context
2. For code questions: Reference specific file names, line numbers, functions, and provide code snippets
3. For security questions: Identify specific vulnerabilities, assess impact, and provide remediation steps
4. For review questions: Quote exact reviewer comments and provide context
5. For performance questions: Identify bottlenecks and suggest specific optimizations
6. Be comprehensive yet concise - provide actionable insights
7. Reference specific sources (file names, reviewer names, line numbers)
8. Avoid generic responses - be specific to this PR's context
9. If information is incomplete, clearly state what additional context would help

**Response Format:**
Respond with ONLY a valid JSON object in this exact format:
{
  "answer": "Your detailed answer with specific references (file:line) and exact quotes",
  "message_type": "text|code|json|markdown",
  "context_used": ["metadata", "files", "reviews"],
  "followup_questions": ["Question 1?", "Question 2?", "Question 3?"],
  "confidence_score": 0.85,
  "sources": ["PR metadata", "File: auth.ts:45-67", "Review by @username: 'specific quote'"]
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

  private buildSecurityAnalysisInstructions(contextData: any): string {
    if (!contextData?.summary?.security_concerns && !contextData?.files) {
      return '';
    }

    let instructions = '\n**Security Analysis Guidelines:**\n';

    if (contextData?.summary?.security_concerns?.length > 0) {
      instructions += `- Specific security concerns found: ${contextData.summary.security_concerns.join(', ')}\n`;
      instructions +=
        "- For each concern, explain: What it is, Why it's risky, How to fix it\n";
      instructions +=
        '- Assess the severity level (Critical/High/Medium/Low) for each issue\n';
    }

    if (contextData?.files) {
      instructions +=
        '- Examine authentication, authorization, input validation, and data handling in the changed files\n';
      instructions +=
        '- Look for potential SQL injection, XSS, CSRF, or other common vulnerabilities\n';
      instructions +=
        '- Check for hardcoded secrets, weak encryption, or insecure configurations\n';
    }

    instructions +=
      '- Provide specific remediation steps with code examples where applicable\n';
    instructions +=
      '- Rate the overall security impact of this PR on a 1-10 scale with justification\n';

    return instructions;
  }

  private buildCodeAnalysisInstructions(contextData: any): string {
    if (!contextData?.files) {
      return '';
    }

    let instructions = '\n**Code Analysis Guidelines:**\n';

    const files = contextData.files.files || [];
    const largestFiles = files.slice(0, 3);

    if (largestFiles.length > 0) {
      instructions += '- Focus on these files with the most changes:\n';
      largestFiles.forEach((file: any) => {
        instructions += `  * ${file.filename} (+${file.additions}/-${file.deletions} lines)\n`;
      });
    }

    instructions += '- For each significant change:\n';
    instructions += '  * Explain what the code does and why it was changed\n';
    instructions +=
      '  * Identify potential bugs, edge cases, or logic issues\n';
    instructions +=
      '  * Assess code quality, readability, and maintainability\n';
    instructions += '  * Suggest improvements or optimizations\n';
    instructions += '- Reference specific functions, classes, or code blocks\n';
    instructions += '- Include relevant code snippets in your analysis\n';
    instructions += '- Highlight any breaking changes or API modifications\n';

    return instructions;
  }

  private parseOpenAIResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    classification: QueryClassification,
    sessionId?: string,
    contextData?: any,
  ): ChatLLMResponse {
    try {
      const content = response.choices[0]?.message?.content;
      this.logger.log('Raw OpenAI response content:', content);

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsed = JSON.parse(content);
      this.logger.log('Parsed OpenAI response:', parsed);

      // Generate adaptive followup questions if none provided or if they're generic
      let followupQuestions = Array.isArray(parsed.followup_questions)
        ? parsed.followup_questions.slice(0, 3)
        : [];

      // Use adaptive followups if session available and current followups are generic/empty
      if (
        this.enableConversationContext &&
        sessionId &&
        (followupQuestions.length === 0 ||
          this.areFollowupsGeneric(followupQuestions))
      ) {
        try {
          followupQuestions =
            this.conversationContextService.generateAdaptiveFollowups(
              sessionId,
              classification.primary_type,
              contextData || {},
            );
        } catch (followupError) {
          this.logger.warn(
            'Failed to generate adaptive followups:',
            followupError,
          );
          // Keep existing followups
        }
      }

      // Fallback to default if still empty
      if (followupQuestions.length === 0) {
        followupQuestions = this.generateFallbackFollowups(
          classification.primary_type,
        );
      }

      // Handle both string and object answers
      let processedAnswer = parsed.answer || 'No answer provided';
      if (typeof processedAnswer === 'object') {
        // If OpenAI returned a JSON object, keep it as is for JSON message types
        if (parsed.message_type === 'json') {
          processedAnswer = parsed.answer;
        } else {
          // For other message types, convert to string
          processedAnswer = JSON.stringify(parsed.answer, null, 2);
        }
      }

      const finalResponse = {
        answer: processedAnswer,
        message_type:
          this.validateMessageType(parsed.message_type) || MessageType.TEXT,
        context_used: Array.isArray(parsed.context_used)
          ? parsed.context_used
          : [],
        followup_questions: followupQuestions,
        confidence_score:
          typeof parsed.confidence_score === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence_score))
            : 0.5,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      };

      const answerLength =
        typeof finalResponse.answer === 'string'
          ? finalResponse.answer.length
          : JSON.stringify(finalResponse.answer).length;

      this.logger.log('Final ChatLLMResponse:', {
        hasAnswer: !!finalResponse.answer,
        answerLength: answerLength,
        answerType: typeof finalResponse.answer,
        messageType: finalResponse.message_type,
        contextUsedLength: finalResponse.context_used?.length || 0,
      });

      return finalResponse;
    } catch (error) {
      this.logger.error('Failed to parse OpenAI chat response:', error);
      return this.getFallbackResponse('Failed to parse LLM response');
    }
  }

  private parseClassificationResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
  ): QueryClassification {
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in classification response');
      }

      const parsed = JSON.parse(content);

      return {
        primary_type:
          this.validateQueryType(parsed.primary_type) || QueryType.GENERAL,
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.5,
        context_needed: Array.isArray(parsed.context_needed)
          ? parsed.context_needed
          : ['metadata'],
        specific_filters: parsed.specific_filters || undefined,
      };
    } catch (error) {
      this.logger.error('Failed to parse classification response:', error);
      return this.getFallbackClassification();
    }
  }

  private validateMessageType(type: string): MessageType | null {
    const validTypes = Object.values(MessageType) as string[];
    return validTypes.includes(type) ? (type as MessageType) : null;
  }

  private validateQueryType(type: string): QueryType | null {
    const validTypes = Object.values(QueryType);
    return validTypes.includes(type as QueryType) ? (type as QueryType) : null;
  }

  private generateFallbackFollowups(queryType: QueryType): string[] {
    const fallbackMap = {
      [QueryType.SUMMARY]: [
        'What files were changed in this PR?',
        'What did reviewers say about this PR?',
        'Are there any security concerns?',
      ],
      [QueryType.CODE_ANALYSIS]: [
        'Show me the diff for a specific file',
        'What are the main code changes?',
        'Are there any performance implications?',
      ],
      [QueryType.REVIEWS]: [
        'What feedback did reviewers provide?',
        'Has this PR been approved?',
        'Are there any requested changes?',
      ],
      [QueryType.SECURITY]: [
        'What specific security issues were found?',
        'How can these security concerns be addressed?',
        'Are there any authentication-related changes?',
      ],
      [QueryType.PERFORMANCE]: [
        'What performance optimizations are recommended?',
        'Are there any bottlenecks in the code?',
        'How does this impact system performance?',
      ],
      [QueryType.FILES]: [
        'Show me the largest changes',
        'What programming languages are used?',
        'Are there any new files added?',
      ],
      [QueryType.TESTS]: [
        'What tests are recommended?',
        'Is there good test coverage?',
        'Are there any edge cases to consider?',
      ],
      [QueryType.TIMELINE]: [
        'When was this PR created?',
        'When was it last updated?',
        'What is the review timeline?',
      ],
      [QueryType.GENERAL]: [
        'What is this PR about?',
        'Who authored this PR?',
        'What is the current status?',
      ],
    };

    return fallbackMap[queryType] || fallbackMap[QueryType.GENERAL];
  }

  private getFallbackResponse(reason: string): ChatLLMResponse {
    this.logger.warn(`Using fallback response due to: ${reason}`);
    return {
      answer: `I apologize, but I'm unable to process your request right now. ${reason}`,
      message_type: MessageType.TEXT,
      context_used: [],
      followup_questions: [
        'Could you please rephrase your question?',
        'Would you like to ask about something else?',
        'Is there specific information you need about this PR?',
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

  private areFollowupsGeneric(followups: string[]): boolean {
    const genericPatterns = [
      /what.*specific/i,
      /are there any/i,
      /could you/i,
      /would you like/i,
      /what else/i,
      /anything else/i,
    ];

    return followups.every((followup) =>
      genericPatterns.some((pattern) => pattern.test(followup)),
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

      if (
        !Array.isArray(response.context_used) ||
        !Array.isArray(response.followup_questions)
      ) {
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
