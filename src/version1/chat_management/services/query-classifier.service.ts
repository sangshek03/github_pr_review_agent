import { Injectable, Logger } from '@nestjs/common';
import { QueryType, QueryClassification } from '../types/chat.types';

@Injectable()
export class QueryClassifierService {
  private readonly logger = new Logger(QueryClassifierService.name);

  private readonly queryPatterns = {
    [QueryType.SUMMARY]: [
      /what.*(is|about|does).*pr/i,
      /summarize.*pr/i,
      /overview.*pr/i,
      /tell me about.*pr/i,
      /what.*pr.*do/i,
      /explain/i,
      /describe/i,
      /tell.*about/i,
      /what.*this/i,
    ],
    [QueryType.CODE_ANALYSIS]: [
      /show.*code/i,
      /what.*changed/i,
      /diff.*file/i,
      /code.*review/i,
      /implementation/i,
      /show.*function/i,
      /class.*method/i,
      /improve/i,
      /better/i,
      /enhance/i,
      /fix/i,
      /optimize/i,
      /refactor/i,
      /areas.*improve/i,
      /where.*improve/i,
      /make.*plan/i,
      /plan.*improve/i,
    ],
    [QueryType.REVIEWS]: [
      /review.*comment/i,
      /what.*reviewer/i,
      /feedback/i,
      /comment.*pr/i,
      /review.*say/i,
      /approval/i,
    ],
    [QueryType.SECURITY]: [
      /security.*issue/i,
      /vulnerabilit/i,
      /security.*concern/i,
      /auth.*problem/i,
      /secure/i,
    ],
    [QueryType.PERFORMANCE]: [
      /performance.*issue/i,
      /slow/i,
      /optimization/i,
      /memory.*leak/i,
      /performance.*concern/i,
    ],
    [QueryType.TIMELINE]: [
      /when.*created/i,
      /when.*merged/i,
      /timeline/i,
      /date/i,
      /history/i,
    ],
    [QueryType.FILES]: [
      /files.*changed/i,
      /what.*files/i,
      /file.*modified/i,
      /added.*files/i,
      /deleted.*files/i,
    ],
    [QueryType.TESTS]: [
      /test.*recommendation/i,
      /test.*coverage/i,
      /unit.*test/i,
      /test.*case/i,
      /testing/i,
    ],
  };

  async classifyQuery(query: string): Promise<QueryClassification> {
    try {
      const classifications = this.calculateConfidenceScores(query);
      const bestMatch = this.findBestMatch(classifications);

      return {
        primary_type: bestMatch.type,
        confidence: bestMatch.confidence,
        context_needed: this.getContextForQueryType(bestMatch.type),
        specific_filters: this.extractFilters(query, bestMatch.type),
      };
    } catch (error) {
      this.logger.error('Failed to classify query:', error);
      return this.getFallbackClassification();
    }
  }

  private calculateConfidenceScores(query: string): Array<{ type: QueryType; confidence: number }> {
    const results: Array<{ type: QueryType; confidence: number }> = [];

    Object.entries(this.queryPatterns).forEach(([type, patterns]) => {
      let maxConfidence = 0;

      patterns.forEach(pattern => {
        if (pattern.test(query)) {
          const match = query.match(pattern);
          if (match) {
            const confidence = Math.min(1.0, match[0].length / query.length + 0.3);
            maxConfidence = Math.max(maxConfidence, confidence);
          }
        }
      });

      if (maxConfidence > 0) {
        results.push({ type: type as QueryType, confidence: maxConfidence });
      }
    });

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private findBestMatch(classifications: Array<{ type: QueryType; confidence: number }>): { type: QueryType; confidence: number } {
    if (classifications.length === 0) {
      return { type: QueryType.GENERAL, confidence: 0.5 };
    }

    const bestMatch = classifications[0];

    // If confidence is too low, classify as general
    if (bestMatch.confidence < 0.3) {
      return { type: QueryType.GENERAL, confidence: 0.5 };
    }

    return bestMatch;
  }

  private getContextForQueryType(queryType: QueryType): string[] {
    const contextMap = {
      [QueryType.SUMMARY]: ['metadata', 'summary'],
      [QueryType.CODE_ANALYSIS]: ['files', 'metadata'],
      [QueryType.REVIEWS]: ['reviews', 'comments'],
      [QueryType.SECURITY]: ['summary', 'files'],
      [QueryType.PERFORMANCE]: ['summary', 'files'],
      [QueryType.TIMELINE]: ['metadata'],
      [QueryType.FILES]: ['files'],
      [QueryType.TESTS]: ['summary', 'files'],
      [QueryType.GENERAL]: ['metadata', 'summary'],
    };

    return contextMap[queryType] || ['metadata'];
  }

  private extractFilters(query: string, queryType: QueryType): any {
    const filters: any = {};

    // Extract file names
    const fileMatches = query.match(/(\w+\.(js|ts|py|java|cpp|c|h|css|html|json|xml|yml|yaml|md))/gi);
    if (fileMatches) {
      filters.file_names = fileMatches;
    }

    // Extract user mentions
    const userMatches = query.match(/@(\w+)/g);
    if (userMatches) {
      filters.user_mentions = userMatches.map(mention => mention.substring(1));
    }

    // Extract date references (simple patterns)
    const dateMatches = query.match(/(yesterday|today|last week|last month|\d{4}-\d{2}-\d{2})/gi);
    if (dateMatches) {
      filters.date_references = dateMatches;
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  }

  private getFallbackClassification(): QueryClassification {
    return {
      primary_type: QueryType.GENERAL,
      confidence: 0.5,
      context_needed: ['metadata', 'summary'],
    };
  }

  // Enhanced rule-based classification with conversation context
  classifyQueryRuleBased(query: string, conversationHistory?: any[]): QueryClassification | null {
    const lowerQuery = query.toLowerCase().trim();

    // Handle greetings with context from conversation
    if (this.isGreeting(lowerQuery) && conversationHistory && conversationHistory.length > 0) {
      const lastTopic = this.extractLastTopic(conversationHistory);
      return {
        primary_type: lastTopic || QueryType.SUMMARY,
        confidence: 0.8,
        context_needed: ['metadata', 'summary', 'files'],
      };
    }

    // Improvement-related queries
    if (lowerQuery.includes('improve') || lowerQuery.includes('areas') || lowerQuery.includes('plan')) {
      return {
        primary_type: QueryType.CODE_ANALYSIS,
        confidence: 0.9,
        context_needed: ['metadata', 'summary', 'files'],
      };
    }

  classifyQueryRuleBased(query: string): QueryClassification | null {
    const lowerQuery = query.toLowerCase();

    // High-confidence exact matches
    if (lowerQuery.includes('what files changed') || lowerQuery.includes('files modified')) {
      return {
        primary_type: QueryType.FILES,
        confidence: 0.95,
        context_needed: ['files'],
      };
    }

    if (lowerQuery.includes('security issues') || lowerQuery.includes('security concerns')) {
      return {
        primary_type: QueryType.SECURITY,
        confidence: 0.95,
        context_needed: ['summary', 'files'],
      };
    }

    if (lowerQuery.includes('what did reviewers say') || lowerQuery.includes('review comments')) {
      return {
        primary_type: QueryType.REVIEWS,
        confidence: 0.95,
        context_needed: ['reviews', 'comments'],
      };
    }

    return null;
  }

  private isGreeting(query: string): boolean {
    const greetingPatterns = [
      /^h(i|ey|ello)/i,
      /^good (morning|afternoon|evening)/i,
      /^how.*you/i,
    ];
    return greetingPatterns.some(pattern => pattern.test(query));
  }

  private extractLastTopic(conversationHistory: any[]): QueryType | undefined {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const message = conversationHistory[i];
      if (message.query_classification && message.sender_type === 'bot') {
        return message.query_classification as QueryType;
      }
    }
    return undefined;
  }

  // Enhanced classification with conversation context
  async classifyWithContext(
    query: string,
    conversationHistory: any[] = []
  ): Promise<QueryClassification> {
    // Try rule-based classification first with context
    const ruleBasedResult = this.classifyQueryRuleBased(query, conversationHistory);
    if (ruleBasedResult) {
      return ruleBasedResult;
    }

    // Fall back to regular classification
    return await this.classifyQuery(query);
  }
}