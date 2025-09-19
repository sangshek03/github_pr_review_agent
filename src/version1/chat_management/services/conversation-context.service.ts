import { Injectable, Logger } from '@nestjs/common';
import { ChatMessage } from '../chat-messages/chat-messages.entity';
import { QueryType, QueryClassification } from '../types/chat.types';

export interface ConversationState {
  sessionId: string;
  discussedTopics: Set<string>;
  answeredQuestions: string[];
  userKnowledgeLevel: 'beginner' | 'intermediate' | 'expert';
  currentFocus: QueryType | null;
  specificEntitiesDiscussed: {
    files: Set<string>;
    reviewers: Set<string>;
    securityConcerns: Set<string>;
    performanceIssues: Set<string>;
  };
  lastResponseType: string;
  conversationFlow: Array<{
    query: string;
    classification: QueryType;
    timestamp: Date;
    topics: string[];
  }>;
}

@Injectable()
export class ConversationContextService {
  private readonly logger = new Logger(ConversationContextService.name);
  private conversationStates = new Map<string, ConversationState>();

  initializeConversation(sessionId: string): ConversationState {
    const state: ConversationState = {
      sessionId,
      discussedTopics: new Set(),
      answeredQuestions: [],
      userKnowledgeLevel: 'intermediate', // Default assumption
      currentFocus: null,
      specificEntitiesDiscussed: {
        files: new Set(),
        reviewers: new Set(),
        securityConcerns: new Set(),
        performanceIssues: new Set(),
      },
      lastResponseType: '',
      conversationFlow: [],
    };

    this.conversationStates.set(sessionId, state);
    return state;
  }

  updateConversationState(
    sessionId: string,
    query: string,
    classification: QueryClassification,
    responseContent: any,
    contextUsed: string[],
  ): ConversationState {
    let state = this.conversationStates.get(sessionId);
    if (!state) {
      state = this.initializeConversation(sessionId);
    }

    // Ensure responseContent is a string
    const responseString =
      typeof responseContent === 'string'
        ? responseContent
        : String(responseContent || '');

    // Update discussed topics
    this.extractAndAddTopics(state, query, responseString);

    // Update knowledge level based on query complexity
    this.updateUserKnowledgeLevel(state, query);

    // Track specific entities mentioned
    this.updateSpecificEntities(state, query, responseString);

    // Update conversation flow
    state.conversationFlow.push({
      query,
      classification: classification.primary_type,
      timestamp: new Date(),
      topics: this.extractTopicsFromQuery(query),
    });

    // Keep only last 20 conversation turns for memory efficiency
    if (state.conversationFlow.length > 20) {
      state.conversationFlow = state.conversationFlow.slice(-20);
    }

    state.currentFocus = classification.primary_type;
    state.lastResponseType = contextUsed.join(',');
    state.answeredQuestions.push(query.toLowerCase());

    this.conversationStates.set(sessionId, state);
    return state;
  }

  getConversationState(sessionId: string): ConversationState | null {
    return this.conversationStates.get(sessionId) || null;
  }

  generateContextualPromptEnhancement(
    sessionId: string,
    currentQuery: string,
  ): string {
    const state = this.conversationStates.get(sessionId);
    if (!state) {
      return '';
    }

    let enhancement = '\n**Conversation Context:**\n';

    // Add discussion history
    if (state.discussedTopics.size > 0) {
      enhancement += `- Previously discussed: ${Array.from(state.discussedTopics).join(', ')}\n`;
    }

    // Add user knowledge level context
    enhancement += `- User knowledge level: ${state.userKnowledgeLevel}\n`;

    // Add conversation flow patterns
    if (state.conversationFlow.length > 1) {
      const recentFlow = state.conversationFlow.slice(-3);
      enhancement += `- Recent question pattern: ${recentFlow.map((f) => f.classification).join(' → ')}\n`;
    }

    // Add specific entities context
    const entities = state.specificEntitiesDiscussed;
    if (entities.files.size > 0) {
      enhancement += `- Files already discussed: ${Array.from(entities.files).slice(0, 5).join(', ')}\n`;
    }
    if (entities.reviewers.size > 0) {
      enhancement += `- Reviewers mentioned: ${Array.from(entities.reviewers).join(', ')}\n`;
    }

    // Add directive based on conversation state
    enhancement += '\n**Response Guidelines:**\n';

    if (this.isRepeatingQuestion(state, currentQuery)) {
      enhancement +=
        '- This question is similar to previous ones. Provide NEW specific information or a different perspective.\n';
    }

    if (
      state.conversationFlow.length > 3 &&
      state.currentFocus ===
        state.conversationFlow[state.conversationFlow.length - 2]
          ?.classification
    ) {
      enhancement +=
        '- User is deep-diving into this topic. Provide more detailed, technical information.\n';
    }

    enhancement += `- Adapt complexity to ${state.userKnowledgeLevel} level\n`;
    enhancement +=
      '- Reference specific code sections, line numbers, and exact reviewer quotes when possible\n';
    enhancement +=
      '- Avoid repeating information already provided in this conversation\n';

    return enhancement;
  }

  generateAdaptiveFollowups(
    sessionId: string,
    currentClassification: QueryType,
    contextData: any,
  ): string[] {
    const state = this.conversationStates.get(sessionId);
    if (!state) {
      return this.getDefaultFollowups(currentClassification);
    }

    const followups: string[] = [];
    const discussedTopics = Array.from(state.discussedTopics);

    // Generate followups based on undiscussed areas
    if (!discussedTopics.includes('files') && contextData?.files) {
      followups.push(
        `What specific files should I focus on reviewing? (${contextData.files.total_files} files changed)`,
      );
    }

    if (
      !discussedTopics.includes('security') &&
      contextData?.summary?.security_concerns?.length > 0
    ) {
      followups.push(`Are there any security vulnerabilities in this PR?`);
    }

    if (
      !discussedTopics.includes('reviews') &&
      contextData?.reviews?.total_reviews > 0
    ) {
      const reviewStates = contextData.reviews.summary;
      if (reviewStates.changes_requested_count > 0) {
        followups.push(`What specific changes did reviewers request?`);
      }
    }

    if (
      !discussedTopics.includes('performance') &&
      contextData?.summary?.performance_issues?.length > 0
    ) {
      followups.push(`What performance implications does this PR have?`);
    }

    // Add specific technical followups based on conversation level
    if (state.userKnowledgeLevel === 'expert' && contextData?.files) {
      const largestFile = contextData.files.files?.[0];
      if (largestFile) {
        followups.push(
          `Can you analyze the changes in ${largestFile.filename}?`,
        );
      }
    }

    // Fill remaining slots with context-specific questions
    while (followups.length < 3) {
      const remaining = this.getContextSpecificFollowups(
        currentClassification,
        contextData,
        discussedTopics,
      );
      const newFollowup = remaining.find((q) => !followups.includes(q));
      if (newFollowup) {
        followups.push(newFollowup);
      } else {
        break;
      }
    }

    return followups.slice(0, 3);
  }

  private extractAndAddTopics(
    state: ConversationState,
    query: string,
    response: string,
  ): void {
    const queryLower = query.toLowerCase();
    const responseLower = response.toLowerCase();

    // Extract topics from keywords
    const topicKeywords = {
      files: ['file', 'files', 'changed', 'modified', 'added', 'deleted'],
      security: ['security', 'vulnerable', 'exploit', 'auth', 'permission'],
      performance: ['performance', 'slow', 'optimization', 'memory', 'cpu'],
      reviews: ['review', 'reviewer', 'feedback', 'comment', 'approve'],
      tests: ['test', 'testing', 'coverage', 'unit test', 'integration'],
      documentation: ['docs', 'documentation', 'readme', 'comment'],
      architecture: ['architecture', 'design', 'pattern', 'structure'],
    };

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (
        keywords.some(
          (keyword) =>
            queryLower.includes(keyword) || responseLower.includes(keyword),
        )
      ) {
        state.discussedTopics.add(topic);
      }
    });
  }

  private updateUserKnowledgeLevel(
    state: ConversationState,
    query: string,
  ): void {
    const queryLower = query.toLowerCase();

    // Technical indicators suggest higher knowledge level
    const expertIndicators = [
      'implementation',
      'architecture',
      'design pattern',
      'algorithm',
      'complexity',
      'performance optimization',
      'memory leak',
      'thread safety',
    ];

    // Basic indicators suggest beginner level
    const beginnerIndicators = [
      'what is',
      'how to',
      'help me understand',
      'explain',
      'basic',
    ];

    if (expertIndicators.some((indicator) => queryLower.includes(indicator))) {
      state.userKnowledgeLevel = 'expert';
    } else if (
      beginnerIndicators.some((indicator) => queryLower.includes(indicator))
    ) {
      state.userKnowledgeLevel = 'beginner';
    }
    // Keep intermediate as default
  }

  private updateSpecificEntities(
    state: ConversationState,
    query: string,
    response: string,
  ): void {
    // Extract file names
    const fileMatches = (query + ' ' + response).match(
      /(\w+\.(js|ts|py|java|cpp|c|h|css|html|json|xml|yml|yaml|md))/gi,
    );
    if (fileMatches) {
      fileMatches.forEach((file) =>
        state.specificEntitiesDiscussed.files.add(file),
      );
    }

    // Extract reviewer mentions
    const reviewerMatches = (query + ' ' + response).match(/@(\w+)/g);
    if (reviewerMatches) {
      reviewerMatches.forEach((reviewer) =>
        state.specificEntitiesDiscussed.reviewers.add(reviewer.substring(1)),
      );
    }
  }

  private extractTopicsFromQuery(query: string): string[] {
    const queryLower = query.toLowerCase();
    const topics: string[] = [];

    const topicPatterns = {
      'code-analysis': /code|implementation|function|class|method/,
      security: /security|vulnerable|exploit|auth/,
      performance: /performance|slow|optimization|memory/,
      testing: /test|testing|coverage/,
      documentation: /docs|documentation|readme/,
    };

    Object.entries(topicPatterns).forEach(([topic, pattern]) => {
      if (pattern.test(queryLower)) {
        topics.push(topic);
      }
    });

    return topics;
  }

  private isRepeatingQuestion(
    state: ConversationState,
    currentQuery: string,
  ): boolean {
    const currentQueryLower = currentQuery.toLowerCase();
    const threshold = 0.7; // Similarity threshold

    return state.answeredQuestions.some((previousQuery) => {
      const similarity = this.calculateStringSimilarity(
        currentQueryLower,
        previousQuery,
      );
      return similarity > threshold;
    });
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private getDefaultFollowups(classification: QueryType): string[] {
    const fallbackMap = {
      [QueryType.SUMMARY]: [
        'What files were changed in this PR?',
        'What did reviewers say about this PR?',
        'Are there any security concerns?',
      ],
      [QueryType.CODE_ANALYSIS]: [
        'Show me the largest code changes',
        'What are the main implementation details?',
        'Are there any potential bugs in the changes?',
      ],
      [QueryType.REVIEWS]: [
        'What specific feedback did reviewers provide?',
        'Has this PR been approved?',
        'Are there any unresolved review comments?',
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
        'Show me the files with the most changes',
        'What programming languages are used?',
        'Are there any configuration files changed?',
      ],
      [QueryType.TESTS]: [
        'What types of tests should be added?',
        'Is there adequate test coverage?',
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

    return fallbackMap[classification] || fallbackMap[QueryType.GENERAL];
  }

  private getContextSpecificFollowups(
    classification: QueryType,
    contextData: any,
    discussedTopics: string[],
  ): string[] {
    const followups: string[] = [];

    // Add specific followups based on actual PR data
    if (contextData?.files && !discussedTopics.includes('files')) {
      const totalChanges =
        contextData.files.summary?.total_additions +
        contextData.files.summary?.total_deletions;
      followups.push(
        `This PR has ${totalChanges} total changes. Should I focus on any specific areas?`,
      );
    }

    if (contextData?.reviews && !discussedTopics.includes('reviews')) {
      const approvedCount = contextData.reviews.summary?.approved_count || 0;
      const changesRequestedCount =
        contextData.reviews.summary?.changes_requested_count || 0;

      if (changesRequestedCount > 0) {
        followups.push(
          `${changesRequestedCount} reviewers requested changes. What are the main concerns?`,
        );
      } else if (approvedCount > 0) {
        followups.push(
          `${approvedCount} reviewers approved this. What did they like about it?`,
        );
      }
    }

    if (contextData?.summary && !discussedTopics.includes('quality')) {
      const score = contextData.summary.overall_score;
      if (score < 7) {
        followups.push(
          `The overall code quality score is ${score}/10. What are the main issues?`,
        );
      }
    }

    return followups;
  }

  cleanupSession(sessionId: string): void {
    this.conversationStates.delete(sessionId);
  }
}
