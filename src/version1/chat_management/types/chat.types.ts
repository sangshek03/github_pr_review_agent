export enum QueryType {
  SUMMARY = 'summary',
  CODE_ANALYSIS = 'code',
  REVIEWS = 'reviews',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  TIMELINE = 'timeline',
  FILES = 'files',
  TESTS = 'tests',
  GENERAL = 'general',
}

export interface QueryClassification {
  primary_type: QueryType;
  confidence: number;
  context_needed: string[];
  specific_filters?: {
    file_names?: string[];
    user_mentions?: string[];
    date_range?: { start: Date; end: Date };
  };
}

export interface ChatLLMRequest {
  query: string;
  classification: QueryClassification;
  context_data: any;
  conversation_history: any[];
  pr_context?: any;
  repository_context?: any;
}

export interface ChatLLMResponse {
  answer: string;
  message_type: string;
  context_used: string[];
  followup_questions: string[];
  confidence_score: number;
  sources: string[];
}

export interface ResponseEvaluation {
  is_valid: boolean;
  hallucination_score: number;
  relevance_score: number;
  issues: string[];
}

export interface ChatMetrics {
  queries_per_minute: number;
  avg_response_time: number;
  context_hit_rate: number;
  user_satisfaction_score: number;
  error_rate: number;
}

export interface WebSocketEvents {
  'message:send': { session_id: string; message: string };
  'typing:start': { session_id: string };
  'typing:stop': { session_id: string };
  'message:new': {
    message: any;
    response_metadata: {
      context_used: string[];
      followup_questions: string[];
      confidence_score: number;
    };
  };
  'message:typing': { session_id: string; is_typing: boolean };
  'session:updated': { session: any };
  error: { code: string; message: string };
}