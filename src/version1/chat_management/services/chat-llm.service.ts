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

    // Analyze conversation context for better prompting
    const conversationContext = this.analyzeConversationContext(conversation_history || []);

    let contextSection = '';
    if (context_data) {
      contextSection = this.formatContextDataDetailed(context_data, classification.primary_type, conversationContext);
    }

    let conversationSection = '';
    if (conversation_history && conversation_history.length > 0) {
      conversationSection = this.formatConversationHistoryDetailed(conversation_history, conversationContext);
    }

    const systemMessage = this.buildDynamicSystemMessage(classification, conversationContext);

    return `${systemMessage}

**Current Question:** ${query}
**Query Classification:** ${classification.primary_type} (confidence: ${classification.confidence})
**Conversation Context:** ${conversationContext.summary}

${contextSection}

${conversationSection}

**Critical Instructions:**
1. BE SPECIFIC: Reference actual file names, functions, line numbers from the context
2. AVOID REPETITION: Don't repeat advice already given in conversation${conversationContext.needsNewPerspective ? ' - provide NEW insights' : ''}
3. BUILD ON PREVIOUS: Reference and build upon previous discussion points
4. PROVIDE ACTIONABLE STEPS: Give concrete, implementable recommendations with file names
5. USE REAL DATA: Quote actual code snippets, reviewer comments, specific metrics
6. NO GENERIC ADVICE: Instead of "add tests", say "add tests to ${this.extractSpecificFiles(context_data)}"

${this.getSpecificInstructionsForQuery(classification.primary_type, conversationContext)}

**Response Format:**
Respond with ONLY a valid JSON object in this exact format:
{
  "answer": "Specific, actionable answer referencing actual files and data",
  "message_type": "text|code|json|markdown",
  "context_used": ["specific", "data", "sources"],
  "followup_questions": ["Specific follow-up based on this PR context"],
  "confidence_score": 0.85,
  "sources": ["Specific files, reviews, or data sources"]
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

  private buildDynamicSystemMessage(classification: QueryClassification, conversationContext: any): string {
    const baseMessage = "You are an expert GitHub PR analysis assistant.";

    switch (classification.primary_type) {
      case QueryType.CODE_ANALYSIS:
        return `${baseMessage} You specialize in code review and improvement recommendations. Always reference specific files, functions, and line numbers. Provide concrete, actionable advice based on the actual code changes in this PR.`;

      case QueryType.SECURITY:
        return `${baseMessage} You are a security specialist. Analyze the actual code changes for security vulnerabilities. Be specific about which files contain issues and provide concrete fixes.`;

      case QueryType.REVIEWS:
        return `${baseMessage} Focus on reviewer feedback analysis. Quote specific reviewer comments and provide context about their concerns and recommendations.`;

      default:
        if (conversationContext.isFollowUp) {
          return `${baseMessage} This is a follow-up question. Build upon the previous conversation. Reference what was already discussed and provide new, additional insights.`;
        }
        return baseMessage;
    }
  }

  private getSpecificInstructionsForQuery(queryType: QueryType, conversationContext: any): string {
    const instructions = {
      [QueryType.CODE_ANALYSIS]: `
**Code Analysis Instructions:**
- Analyze the actual changed files and provide specific line-by-line feedback
- Suggest concrete refactoring opportunities with file names
- Identify specific patterns or anti-patterns in the code
- Reference actual function names and implementation details
- Provide file-specific improvement recommendations`,

      [QueryType.SECURITY]: `
**Security Analysis Instructions:**
- Point to specific files and lines with security concerns
- Provide concrete remediation steps with code examples
- Reference security best practices applicable to this specific codebase
- Identify specific vulnerability types (SQL injection, XSS, etc.)`,

      [QueryType.REVIEWS]: `
**Review Analysis Instructions:**
- Quote specific reviewer comments with attribution
- Explain the context behind reviewer concerns
- Reference specific files mentioned in reviews
- Summarize action items from reviewer feedback`,

      [QueryType.GENERAL]: conversationContext.isFollowUp ? `
**Follow-up Instructions:**
- Build upon previous conversation without repeating
- Provide new insights not already discussed
- Reference specific aspects of the PR not yet covered
- Ask clarifying questions to understand user's specific needs` : `
**General Analysis Instructions:**
- Provide comprehensive overview with specific details
- Focus on most impactful aspects of this PR
- Use actual data and metrics from the context
- Highlight key files and changes`
    };

    return instructions[queryType] || instructions[QueryType.GENERAL];
  }

  private analyzeConversationContext(history: any[]): any {
    if (!history || history.length === 0) {
      return {
        isFirstMessage: true,
        summary: "Starting new conversation about PR",
        needsNewPerspective: false,
        discussedTopics: []
      };
    }

    const recentUserMessages = history
      .filter(m => m.sender_type === 'user')
      .slice(-3)
      .map(m => m.message_content.toLowerCase());

    const recentBotMessages = history
      .filter(m => m.sender_type === 'bot')
      .slice(-2)
      .map(m => m.message_content.toLowerCase());

    const discussedTopics = [];
    const repeatedQuestions = [];

    recentUserMessages.forEach(msg => {
      if (msg.includes('improve') || msg.includes('better')) {
        discussedTopics.push('improvement');
      }
      if (msg.includes('security')) {
        discussedTopics.push('security');
      }
      if (msg.includes('test')) {
        discussedTopics.push('testing');
      }
      // Check for repeated similar questions
      if (recentUserMessages.filter(m => this.calculateSimilarity(m, msg) > 0.7).length > 1) {
        repeatedQuestions.push(msg);
      }
    });

    // Check if bot responses are repetitive
    const botRepetitive = recentBotMessages.length > 1 &&
      recentBotMessages.some((msg, index) =>
        recentBotMessages.slice(index + 1).some(otherMsg =>
          this.calculateSimilarity(msg, otherMsg) > 0.8
        )
      );

    return {
      isFollowUp: history.length > 0,
      discussedTopics: [...new Set(discussedTopics)],
      repeatedQuestions,
      summary: discussedTopics.length > 0
        ? `Continuing discussion about ${discussedTopics.join(', ')}`
        : "General conversation about PR",
      needsNewPerspective: repeatedQuestions.length > 0 || botRepetitive,
      botBeenRepetitive: botRepetitive
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    const intersection = words1.filter(word => words2.includes(word));
    return intersection.length / Math.max(words1.length, words2.length);
  }

  private extractSpecificFiles(context_data: any): string {
    if (!context_data) return 'relevant files';

    if (context_data.files?.files) {
      const mainFiles = context_data.files.files
        .slice(0, 3)
        .map((f: any) => f.filename)
        .join(', ');
      return mainFiles || 'changed files';
    }

    return 'relevant files';
  }

  private formatContextDataDetailed(contextData: any, queryType: QueryType, conversationContext: any): string {
    let formatted = '**Available Context:**\n';

    if (contextData.metadata) {
      formatted += `\n**PR Metadata:**
- Title: ${contextData.metadata.title}
- Author: ${contextData.metadata.author?.login}
- State: ${contextData.metadata.state}
- Description: ${contextData.metadata.description?.substring(0, 200)}...
- Changes: ${contextData.metadata.branches?.base?.ref} ← ${contextData.metadata.branches?.head?.ref}
`;
    }

    if (contextData.code_analysis) {
      formatted += `\n**Code Analysis:**
- Total Changes: +${contextData.code_analysis.change_summary.total_additions}/-${contextData.code_analysis.change_summary.total_deletions}
- Languages: ${contextData.code_analysis.change_summary.languages_affected?.join(', ')}
- High Impact Files: ${contextData.code_analysis.change_summary.high_impact_files?.map((f: any) => `${f.name} (${f.changes} changes)`).join(', ')}
`;

      if (contextData.code_analysis.specific_improvements?.length > 0) {
        formatted += `- Specific Improvements Needed: ${contextData.code_analysis.specific_improvements.join('; ')}
`;
      }
    }

    if (contextData.files) {
      formatted += `\n**Files Changed (${contextData.files.total_files} files):**
`;
      contextData.files.files?.slice(0, 8).forEach((file: any) => {
        formatted += `- ${file.filename} (+${file.additions}/-${file.deletions}) [${file.change_type}] ${file.language ? `(${file.language})` : ''}
`;
      });

      if (contextData.files.analysis?.test_files_missing?.length > 0) {
        formatted += `- Missing Tests: ${contextData.files.analysis.test_files_missing.join(', ')}
`;
      }
    }

    if (contextData.summary) {
      formatted += `\n**AI Analysis Summary:**
- Overall Score: ${contextData.summary.overall_score}/10
- Key Issues: ${contextData.summary.issues_found?.slice(0, 3).join(', ')}
- Security Concerns: ${contextData.summary.security_concerns?.slice(0, 2).join(', ')}
- Performance Issues: ${contextData.summary.performance_issues?.slice(0, 2).join(', ')}
`;
    }

    if (contextData.reviews) {
      formatted += `\n**Reviews (${contextData.reviews.total_reviews} reviews):**
`;
      contextData.reviews.reviews?.slice(0, 3).forEach((review: any) => {
        formatted += `- ${review.reviewer.login}: ${review.state} - "${review.body?.substring(0, 100)}..."
`;
      });
    }

    if (contextData.conversation_context && conversationContext.discussedTopics?.length > 0) {
      formatted += `\n**Previous Discussion Points:**
- Topics covered: ${conversationContext.discussedTopics.join(', ')}
- Context: This is a ${conversationContext.isFollowUp ? 'follow-up' : 'initial'} question
`;
    }

    return formatted;
  }

  private formatConversationHistoryDetailed(history: any[], conversationContext: any): string {
    if (history.length === 0) return '';

    let formatted = '\n**Recent Conversation:**\n';
    const recentHistory = history.slice(-4); // Last 4 messages

    recentHistory.forEach((message, index) => {
      const role = message.sender_type === 'user' ? 'User' : 'Assistant';
      const content = message.message_content.substring(0, 150);
      formatted += `${role}: ${content}${message.message_content.length > 150 ? '...' : ''}\n`;
    });

    if (conversationContext.needsNewPerspective) {
      formatted += '\n**Note:** User seems to be asking similar questions - provide fresh insights and avoid repetition.\n';
    }

    return formatted;
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