import { Injectable, Logger } from '@nestjs/common';
import { ChatLLMResponse, ResponseEvaluation } from '../types/chat.types';

@Injectable()
export class ResponseEvaluatorService {
  private readonly logger = new Logger(ResponseEvaluatorService.name);

  async evaluateResponse(
    query: string,
    response: ChatLLMResponse,
    context: any
  ): Promise<ResponseEvaluation> {
    try {
      const evaluation: ResponseEvaluation = {
        is_valid: true,
        hallucination_score: 0,
        relevance_score: 0,
        issues: [],
      };

      // 1. Validate JSON structure
      const structureValid = this.validateJsonStructure(response);
      if (!structureValid.isValid) {
        evaluation.is_valid = false;
        evaluation.issues.push(...structureValid.issues);
      }

      // 2. Detect hallucination
      evaluation.hallucination_score = this.detectHallucination(response.answer, context);
      if (evaluation.hallucination_score > 0.7) {
        evaluation.is_valid = false;
        evaluation.issues.push('High hallucination detected - response contains information not in context');
      }

      // 3. Assess relevance
      evaluation.relevance_score = this.assessRelevance(query, response.answer);
      if (evaluation.relevance_score < 0.3) {
        evaluation.issues.push('Low relevance - response does not address the query adequately');
      }

      // 4. Check confidence score validity
      if (response.confidence_score < 0 || response.confidence_score > 1) {
        evaluation.is_valid = false;
        evaluation.issues.push('Invalid confidence score - must be between 0 and 1');
      }

      // 5. Check for empty or meaningless responses
      if (this.isEmptyOrMeaningless(response.answer)) {
        evaluation.is_valid = false;
        evaluation.issues.push('Empty or meaningless response');
      }

      // 6. Validate followup questions
      if (!this.validateFollowupQuestions(response.followup_questions)) {
        evaluation.issues.push('Invalid or inappropriate followup questions');
      }

      // 7. Check context usage validity
      if (!this.validateContextUsage(response.context_used, context)) {
        evaluation.issues.push('Context usage mismatch - claimed context not available');
      }

      this.logger.log(`Response evaluation completed - Valid: ${evaluation.is_valid}, Issues: ${evaluation.issues.length}`);
      return evaluation;
    } catch (error) {
      this.logger.error('Response evaluation failed:', error);
      return {
        is_valid: false,
        hallucination_score: 1,
        relevance_score: 0,
        issues: ['Evaluation process failed'],
      };
    }
  }

  private validateJsonStructure(response: ChatLLMResponse): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check required fields
    if (!response.answer || typeof response.answer !== 'string') {
      issues.push('Missing or invalid answer field');
    }

    if (!response.message_type || typeof response.message_type !== 'string') {
      issues.push('Missing or invalid message_type field');
    }

    if (!Array.isArray(response.context_used)) {
      issues.push('context_used must be an array');
    }

    if (!Array.isArray(response.followup_questions)) {
      issues.push('followup_questions must be an array');
    }

    if (typeof response.confidence_score !== 'number') {
      issues.push('confidence_score must be a number');
    }

    if (!Array.isArray(response.sources)) {
      issues.push('sources must be an array');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  private detectHallucination(responseText: string, context: any): number {
    if (!context || !responseText) {
      return 0.5; // Medium score when we can't evaluate
    }

    let hallucinationScore = 0;
    const responseWords = this.extractKeywords(responseText.toLowerCase());
    const contextText = this.extractContextText(context).toLowerCase();
    const contextWords = this.extractKeywords(contextText);

    // Check for factual claims in response
    const factualClaims = this.extractFactualClaims(responseText);
    let unsupportedClaims = 0;

    factualClaims.forEach(claim => {
      if (!this.isClaimSupportedByContext(claim, contextText)) {
        unsupportedClaims++;
      }
    });

    if (factualClaims.length > 0) {
      hallucinationScore = unsupportedClaims / factualClaims.length;
    }

    // Check for specific technical terms not in context
    const technicalTerms = this.extractTechnicalTerms(responseText);
    let unsupportedTerms = 0;

    technicalTerms.forEach(term => {
      if (!contextText.includes(term.toLowerCase())) {
        unsupportedTerms++;
      }
    });

    if (technicalTerms.length > 0) {
      const technicalHallucination = unsupportedTerms / technicalTerms.length;
      hallucinationScore = Math.max(hallucinationScore, technicalHallucination);
    }

    return Math.min(1, hallucinationScore);
  }

  private assessRelevance(query: string, response: string): number {
    if (!query || !response) {
      return 0;
    }

    const queryWords = this.extractKeywords(query.toLowerCase());
    const responseWords = this.extractKeywords(response.toLowerCase());

    if (queryWords.length === 0 || responseWords.length === 0) {
      return 0;
    }

    // Calculate word overlap
    const commonWords = queryWords.filter(word => responseWords.includes(word));
    const wordOverlap = commonWords.length / queryWords.length;

    // Check for query intent match
    const queryIntent = this.identifyQueryIntent(query);
    const responseIntent = this.identifyResponseIntent(response);
    const intentMatch = queryIntent === responseIntent ? 1 : 0.5;

    // Check for direct question answering
    const directAnswer = this.hasDirectAnswer(query, response);

    // Calculate final relevance score
    const relevanceScore = (wordOverlap * 0.4) + (intentMatch * 0.4) + (directAnswer * 0.2);

    return Math.min(1, relevanceScore);
  }

  private isEmptyOrMeaningless(response: string): boolean {
    if (!response || response.trim().length === 0) {
      return true;
    }

    const meaninglessPatterns = [
      /^(sorry|apologize|unable|can't|cannot)\s/i,
      /^(i don't|i'm not sure|i cannot determine)/i,
      /^(no information|no data|not available)/i,
    ];

    return meaninglessPatterns.some(pattern => pattern.test(response.trim()));
  }

  private validateFollowupQuestions(followupQuestions: string[]): boolean {
    if (!Array.isArray(followupQuestions) || followupQuestions.length === 0) {
      return true; // Empty array is acceptable
    }

    return followupQuestions.every(question => {
      return question &&
             typeof question === 'string' &&
             question.trim().length > 0 &&
             question.includes('?');
    });
  }

  private validateContextUsage(contextUsed: string[], context: any): boolean {
    if (!Array.isArray(contextUsed) || contextUsed.length === 0) {
      return true; // Empty array is acceptable
    }

    if (!context) {
      return contextUsed.length === 0;
    }

    const availableContextTypes = Object.keys(context);
    return contextUsed.every(contextType => availableContextTypes.includes(contextType));
  }

  private extractKeywords(text: string): string[] {
    // Remove common stop words and extract meaningful keywords
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  private extractContextText(context: any): string {
    if (!context) return '';

    let text = '';

    // Extract text from different context sections
    if (context.metadata) {
      text += ` ${context.metadata.title || ''} ${context.metadata.description || ''}`;
    }

    if (context.summary) {
      text += ` ${context.summary.summary || ''}`;
      if (context.summary.issues_found) {
        text += ` ${context.summary.issues_found.join(' ')}`;
      }
    }

    if (context.files) {
      text += ` ${context.files.files?.map((f: any) => f.filename).join(' ') || ''}`;
    }

    if (context.reviews) {
      text += ` ${context.reviews.reviews?.map((r: any) => r.body).join(' ') || ''}`;
    }

    return text;
  }

  private extractFactualClaims(text: string): string[] {
    // Simple pattern matching for factual claims
    const claims: string[] = [];

    // Look for definitive statements
    const patterns = [
      /the file (\w+\.\w+) (contains|has|shows)/gi,
      /there are (\d+) (files|issues|problems)/gi,
      /the (author|reviewer) is (\w+)/gi,
      /this pr (adds|removes|modifies|fixes)/gi,
    ];

    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        claims.push(match[0]);
      }
    });

    return claims;
  }

  private extractTechnicalTerms(text: string): string[] {
    // Extract technical terms that should be verified against context
    const technicalPatterns = [
      /\b\w+\.(js|ts|py|java|cpp|c|h|css|html|json|xml|yml|yaml|md)\b/gi,
      /\b(function|class|method|variable|constant|import|export)\s+\w+/gi,
      /\b(API|endpoint|route|service|controller|middleware)\b/gi,
    ];

    const terms: string[] = [];

    technicalPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        terms.push(match[0]);
      }
    });

    return terms;
  }

  private isClaimSupportedByContext(claim: string, contextText: string): boolean {
    // Simple keyword matching to check if claim is supported
    const claimWords = this.extractKeywords(claim);
    const contextWords = this.extractKeywords(contextText);

    const supportedWords = claimWords.filter(word => contextWords.includes(word));
    return supportedWords.length >= Math.ceil(claimWords.length * 0.6);
  }

  private identifyQueryIntent(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('what') || lowerQuery.includes('which')) {
      return 'information';
    }
    if (lowerQuery.includes('how') || lowerQuery.includes('why')) {
      return 'explanation';
    }
    if (lowerQuery.includes('show') || lowerQuery.includes('display')) {
      return 'display';
    }
    if (lowerQuery.includes('list') || lowerQuery.includes('find')) {
      return 'listing';
    }

    return 'general';
  }

  private identifyResponseIntent(response: string): string {
    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('here is') || lowerResponse.includes('the following')) {
      return 'listing';
    }
    if (lowerResponse.includes('because') || lowerResponse.includes('due to')) {
      return 'explanation';
    }
    if (lowerResponse.includes('shows') || lowerResponse.includes('displays')) {
      return 'display';
    }

    return 'information';
  }

  private hasDirectAnswer(query: string, response: string): number {
    // Check if the response directly addresses the query
    const queryWords = this.extractKeywords(query.toLowerCase());
    const responseWords = this.extractKeywords(response.toLowerCase());

    // Look for direct addressing of query terms in the first part of response
    const firstSentence = response.split('.')[0].toLowerCase();
    const addressedWords = queryWords.filter(word => firstSentence.includes(word));

    return addressedWords.length / Math.max(1, queryWords.length);
  }
}