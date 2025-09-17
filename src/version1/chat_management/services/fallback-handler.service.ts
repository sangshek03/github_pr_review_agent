import { Injectable, Logger } from '@nestjs/common';
import { QueryType, ChatLLMResponse } from '../types/chat.types';
import { MessageType } from '../chat-messages/chat-messages.entity';

@Injectable()
export class FallbackHandlerService {
  private readonly logger = new Logger(FallbackHandlerService.name);

  handleMissingContext(queryType: QueryType): ChatLLMResponse {
    this.logger.warn(`Handling missing context for query type: ${queryType}`);

    const fallbackMap = {
      [QueryType.SUMMARY]: {
        answer: "I apologize, but I don't have access to the PR summary information. To get a summary of this PR, please ensure the PR has been fetched and analyzed first.",
        followup_questions: [
          "Would you like me to help you fetch the PR details?",
          "Is there specific information about the PR you're looking for?",
          "Would you like to ask about something else?"
        ]
      },
      [QueryType.CODE_ANALYSIS]: {
        answer: "I don't have access to the code changes for this PR. The files and their modifications haven't been loaded yet. Please fetch the PR details first to analyze the code changes.",
        followup_questions: [
          "Would you like to fetch the PR data first?",
          "Is there a specific file you're interested in?",
          "Would you like to know about other aspects of this PR?"
        ]
      },
      [QueryType.REVIEWS]: {
        answer: "I don't have access to the review information for this PR. The reviews and comments haven't been loaded. Please ensure the PR has been fetched with all its review data.",
        followup_questions: [
          "Would you like to fetch the review data?",
          "Are you looking for feedback from a specific reviewer?",
          "Would you like to know about other PR information?"
        ]
      },
      [QueryType.SECURITY]: {
        answer: "I don't have access to the security analysis for this PR. A security review hasn't been performed yet. Please run the PR analysis first to get security insights.",
        followup_questions: [
          "Would you like me to help you run a security analysis?",
          "Are you concerned about specific security aspects?",
          "Would you like to ask about other PR details?"
        ]
      },
      [QueryType.PERFORMANCE]: {
        answer: "I don't have access to performance analysis data for this PR. Performance insights aren't available without running the PR analysis first.",
        followup_questions: [
          "Would you like to run a performance analysis?",
          "Are you looking for specific performance metrics?",
          "Would you like to explore other aspects of this PR?"
        ]
      },
      [QueryType.FILES]: {
        answer: "I don't have access to the file change information for this PR. The list of modified files hasn't been loaded. Please fetch the PR data first.",
        followup_questions: [
          "Would you like to fetch the PR file data?",
          "Are you looking for changes in a specific directory?",
          "Would you like to know about other PR information?"
        ]
      },
      [QueryType.TESTS]: {
        answer: "I don't have access to test recommendations for this PR. Test analysis requires the PR to be analyzed first.",
        followup_questions: [
          "Would you like to run a test analysis?",
          "Are you looking for specific testing guidance?",
          "Would you like to ask about other PR aspects?"
        ]
      },
      [QueryType.TIMELINE]: {
        answer: "I don't have access to the timeline information for this PR. The metadata hasn't been loaded yet.",
        followup_questions: [
          "Would you like to fetch the PR metadata?",
          "Are you looking for specific dates or events?",
          "Would you like to know about other PR details?"
        ]
      },
      [QueryType.GENERAL]: {
        answer: "I don't have enough information about this PR to answer your question. The PR data hasn't been loaded yet.",
        followup_questions: [
          "Would you like to fetch the PR information first?",
          "Can you be more specific about what you're looking for?",
          "Would you like to explore available PR data?"
        ]
      }
    };

    const fallback = fallbackMap[queryType];

    return {
      answer: fallback.answer,
      message_type: MessageType.TEXT,
      context_used: [],
      followup_questions: fallback.followup_questions,
      confidence_score: 0.8, // High confidence in fallback response
      sources: ['fallback_handler']
    };
  }

  handleLLMFailure(query: string): ChatLLMResponse {
    this.logger.error(`Handling LLM failure for query: ${query}`);

    return {
      answer: "I'm sorry, but I'm experiencing technical difficulties processing your question right now. This could be due to high server load or a temporary service issue. Please try again in a moment.",
      message_type: MessageType.TEXT,
      context_used: [],
      followup_questions: [
        "Would you like to try rephrasing your question?",
        "Can you ask a simpler or more specific question?",
        "Would you like to try again in a few minutes?"
      ],
      confidence_score: 0.9, // High confidence in failure explanation
      sources: ['fallback_handler']
    };
  }

  handleInvalidResponse(query: string, originalResponse?: any): ChatLLMResponse {
    this.logger.warn(`Handling invalid response for query: ${query}`);

    // Try to extract any useful information from the invalid response
    let partialAnswer = "I apologize, but I encountered an issue while processing your question.";

    if (originalResponse?.answer && typeof originalResponse.answer === 'string') {
      // If we have a partial answer, try to use it
      const cleanAnswer = this.sanitizePartialAnswer(originalResponse.answer);
      if (cleanAnswer && cleanAnswer.length > 10) {
        partialAnswer = `I was able to partially process your question: ${cleanAnswer}. However, the complete response may not be fully accurate.`;
      }
    }

    return {
      answer: partialAnswer,
      message_type: MessageType.TEXT,
      context_used: originalResponse?.context_used || [],
      followup_questions: this.generateGenericFollowups(query),
      confidence_score: 0.3, // Low confidence due to invalid response
      sources: ['fallback_handler']
    };
  }

  handleTimeoutError(query: string): ChatLLMResponse {
    this.logger.warn(`Handling timeout error for query: ${query}`);

    return {
      answer: "I'm sorry, but your request is taking longer than expected to process. This might be due to the complexity of your question or current system load. Please try asking a more specific question or try again later.",
      message_type: MessageType.TEXT,
      context_used: [],
      followup_questions: [
        "Would you like to ask a more specific question?",
        "Can you break down your question into smaller parts?",
        "Would you like to try again with a simpler query?"
      ],
      confidence_score: 0.9,
      sources: ['fallback_handler']
    };
  }

  handleContextRetrievalFailure(queryType: QueryType): ChatLLMResponse {
    this.logger.error(`Context retrieval failed for query type: ${queryType}`);

    return {
      answer: "I'm having trouble accessing the relevant information to answer your question. This could be due to a database connection issue or missing data. Please try again, or ask a different question about this PR.",
      message_type: MessageType.TEXT,
      context_used: [],
      followup_questions: [
        "Would you like to try a different question?",
        "Can you ask about general PR information instead?",
        "Would you like to check if the PR data has been loaded?"
      ],
      confidence_score: 0.8,
      sources: ['fallback_handler']
    };
  }

  handleRateLimitError(): ChatLLMResponse {
    this.logger.warn('Handling rate limit error');

    return {
      answer: "I'm currently experiencing high demand and need to limit responses to ensure service availability for all users. Please wait a moment before asking your next question.",
      message_type: MessageType.TEXT,
      context_used: [],
      followup_questions: [
        "Would you like to try again in a minute?",
        "Can you save your question and ask it later?",
        "Would you like tips on how to ask more efficient questions?"
      ],
      confidence_score: 1.0,
      sources: ['fallback_handler']
    };
  }

  handleUnknownError(query: string, error?: any): ChatLLMResponse {
    this.logger.error(`Handling unknown error for query: ${query}`, error);

    return {
      answer: "I encountered an unexpected error while processing your question. Our team has been notified and will investigate the issue. Please try asking your question differently or contact support if the problem persists.",
      message_type: MessageType.TEXT,
      context_used: [],
      followup_questions: [
        "Would you like to rephrase your question?",
        "Can you try asking about something else?",
        "Would you like to report this issue to support?"
      ],
      confidence_score: 0.7,
      sources: ['fallback_handler']
    };
  }

  private sanitizePartialAnswer(answer: string): string {
    // Clean up potentially malformed or incomplete answers
    if (!answer || typeof answer !== 'string') {
      return '';
    }

    // Remove incomplete sentences at the end
    const sentences = answer.split(/[.!?]+/);
    const completeSentences = sentences.slice(0, -1);

    if (completeSentences.length === 0) {
      // If no complete sentences, return the original but truncated
      return answer.substring(0, 100).trim() + '...';
    }

    return completeSentences.join('. ').trim() + '.';
  }

  private generateGenericFollowups(query: string): string[] {
    const genericFollowups = [
      "Would you like to try rephrasing your question?",
      "Can you be more specific about what you're looking for?",
      "Would you like to ask about a different aspect of this PR?"
    ];

    // Try to generate more specific followups based on query content
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('file') || lowerQuery.includes('code')) {
      return [
        "Would you like to ask about specific files that were changed?",
        "Are you looking for code review feedback?",
        "Would you like to know about the overall code changes?"
      ];
    }

    if (lowerQuery.includes('review') || lowerQuery.includes('comment')) {
      return [
        "Would you like to know about reviewer feedback?",
        "Are you looking for specific types of comments?",
        "Would you like to see the review summary?"
      ];
    }

    if (lowerQuery.includes('security') || lowerQuery.includes('vulnerability')) {
      return [
        "Would you like to know about security analysis results?",
        "Are you concerned about specific security issues?",
        "Would you like general security recommendations?"
      ];
    }

    return genericFollowups;
  }

  // Utility method to create a graceful degradation response
  createGracefulDegradation(
    originalQuery: string,
    availableContext: string[],
    missingContext: string[]
  ): ChatLLMResponse {
    let answer = `I can partially answer your question based on the available information (${availableContext.join(', ')}).`;

    if (missingContext.length > 0) {
      answer += ` However, I don't have access to ${missingContext.join(', ')} which might provide more complete information.`;
    }

    return {
      answer,
      message_type: MessageType.TEXT,
      context_used: availableContext,
      followup_questions: [
        "Would you like me to answer based on available information?",
        "Can you ask a more specific question about the available data?",
        "Would you like to fetch the missing information first?"
      ],
      confidence_score: 0.6,
      sources: availableContext.concat(['fallback_handler'])
    };
  }
}