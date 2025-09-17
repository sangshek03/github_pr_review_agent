import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface PRReviewRequest {
  metadata: any;
  reviews: any[];
  comments: any[];
  files: any[];
}

export interface PRReviewResponse {
  pr_summary_id?:string;
  summary: string;
  issues_found: string[];
  suggestions: string[];
  test_recommendations: string[];
  overall_score: number;
  security_concerns: string[];
  performance_issues: string[];
  well_handled_cases: { area: string; reason: string }[];
  future_enhancements: string[];
  code_quality_rating: {
    readability: number;
    maintainability: number;
    scalability: number;
    testing: number;
  };
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private openai: OpenAI;
  private readonly primaryModel: string;
  private readonly fallbackModel: string = 'gpt-4o';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('config.openaiApiKey');
    this.primaryModel =
      this.configService.get<string>('config.openaiModel') || 'gpt-4o-mini';

    if (!apiKey) {
      this.logger.warn(
        'OpenAI API key not configured. LLM services will not be available.',
      );
      return;
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Review a GitHub PR using OpenAI GPT models
   */
  async reviewPR(prData: PRReviewRequest): Promise<PRReviewResponse> {
    if (!this.openai) {
      return this.getFallbackResponse('OpenAI API key not configured');
    }

    try {
      const prompt = this.buildPRReviewPrompt(prData);

      // Try primary model first
      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await this.callOpenAI(prompt, this.primaryModel);
      } catch (primaryError) {
        this.logger.warn(
          `Primary model ${this.primaryModel} failed, trying fallback model ${this.fallbackModel}`,
        );
        response = await this.callOpenAI(prompt, this.fallbackModel);
      }

      return this.parseOpenAIResponse(response);
    } catch (error) {
      this.logger.error('Failed to get PR review from OpenAI:', error);
      return this.getFallbackResponse(
        'PR review failed due to LLM service error',
      );
    }
  }

  /**
   * Build a structured prompt for PR review
   */
  private buildPRReviewPrompt(prData: PRReviewRequest): string {
    const { metadata, reviews, comments, files } = prData;

    // Summarize files to avoid sending huge diffs
    const filesSummary = files.map((file) => ({
      filename: file.filename,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      status: file.status,
      // Include only a snippet of patch for context, not the full diff
      patchPreview: file.patch
        ? file.patch.substring(0, 500) + (file.patch.length > 500 ? '...' : '')
        : null,
    }));

    const reviewsSummary = reviews.map((review) => ({
      user: review.user?.login,
      state: review.state,
      bodyPreview: review.body
        ? review.body.substring(0, 200) +
          (review.body.length > 200 ? '...' : '')
        : null,
    }));

    const commentsSummary = comments.map((comment) => ({
      user: comment.user?.login,
      bodyPreview: comment.body
        ? comment.body.substring(0, 200) +
          (comment.body.length > 200 ? '...' : '')
        : null,
    }));

    return `You are an expert code reviewer. Please review the following GitHub Pull Request and provide structured feedback.

      **PR Details:**
      - Title: ${metadata.title}
      - Author: ${metadata.user?.login}
      - State: ${metadata.state}
      - Description: ${metadata.body?.substring(0, 500) || 'No description provided'}
      - Base Branch: ${metadata.base?.ref} → Head Branch: ${metadata.head?.ref}

      **Files Changed (${files.length} files):**
      ${filesSummary.map((f) => `- ${f.filename}: +${f.additions} -${f.deletions} (${f.status})`).join('\n')}

      **Existing Reviews (${reviews.length}):**
      ${reviewsSummary.map((r) => `- ${r.user}: ${r.state} - ${r.bodyPreview || 'No comment'}`).join('\n')}

      **Comments (${comments.length}):**
      ${commentsSummary.map((c) => `- ${c.user}: ${c.bodyPreview || 'No comment'}`).join('\n')}

      **File Changes Preview:**
      ${filesSummary.map((f) => (f.patchPreview ? `${f.filename}:\n${f.patchPreview}\n---` : '')).join('\n')}

      Please analyze this PR for:
        1. Code quality and best practices
        2. Potential bugs or logical errors
        3. Security vulnerabilities
        4. Performance issues
        5. Missing tests or edge cases
        6. Overall assessment and score
        7. Highlight areas where the PR handles edge cases very well and explain why
        8. Suggest future enhancements or improvements for this codebase
        9. Provide a detailed code quality rating (readability, maintainability, scalability, testing) on a scale of 1–10


        **IMPORTANT**: Respond with ONLY a valid JSON object in this exact format:
        {
          "summary": "Brief overall summary of the PR and review",
          "issues_found": ["issue1", "issue2"],
          "suggestions": ["suggestion1", "suggestion2"],
          "test_recommendations": ["test1", "test2"],
          "overall_score": 7,
          "security_concerns": ["concern1", "concern2"],
          "performance_issues": ["issue1", "issue2"],
          "well_handled_cases": [{"area": "...", "reason": "..."}],
          "future_enhancements": ["..."],
          "code_quality_rating": {
              "readability": 0,
              "maintainability": 0,
              "scalability": 0,
              "testing": 0
            }
        }

        Score should be 1-10 where 10 is excellent and 1 is poor. Return empty arrays [] if no issues found in any category.`;
  }

  /**
   * Call OpenAI API with the given prompt and model
   */
  private async callOpenAI(
    prompt: string,
    model: string,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return await this.openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert code reviewer. Always respond with valid JSON only, no additional text or formatting.',
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
  }

  /**
   * Parse OpenAI response and ensure it matches our interface
   */
  private parseOpenAIResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
  ): PRReviewResponse {
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsed = JSON.parse(content);

      // Ensure all required fields are present with defaults
      return {
        summary: parsed.summary || 'No summary provided',
        issues_found: Array.isArray(parsed.issues_found)
          ? parsed.issues_found
          : [],
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
        test_recommendations: Array.isArray(parsed.test_recommendations)
          ? parsed.test_recommendations
          : [],
        overall_score:
          typeof parsed.overall_score === 'number'
            ? Math.max(1, Math.min(10, parsed.overall_score))
            : 5,
        security_concerns: Array.isArray(parsed.security_concerns)
          ? parsed.security_concerns
          : [],
        performance_issues: Array.isArray(parsed.performance_issues)
          ? parsed.performance_issues
          : [],
        well_handled_cases: parsed.well_handled_cases || [],
        future_enhancements: parsed.future_enhancements || [],
        code_quality_rating: parsed.code_quality_rating || {
          readability: 0,
          maintainability: 0,
          scalability: 0,
          testing: 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to parse OpenAI response:', error);
      return this.getFallbackResponse('Failed to parse LLM response');
    }
  }

  /**
   * Return fallback response when OpenAI fails
   */
  private getFallbackResponse(reason: string): PRReviewResponse {
    return {
      summary: reason,
      issues_found: [],
      suggestions: [],
      test_recommendations: [],
      overall_score: 0,
      security_concerns: [],
      performance_issues: [],
       well_handled_cases:  [],
        future_enhancements: [],
        code_quality_rating: {
          readability: 0,
          maintainability: 0,
          scalability: 0,
          testing: 0,
        },
    };
  }
}
