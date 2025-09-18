import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  PRMetadata,
  PRReview,
  PRComment,
  PRFile,
  AnalyzeDTO,
  FetchPRDto,
} from './pr-fetch.dto';
import { LlmService, PRReviewResponse } from '../llm/llm.service';
import { PrDataService } from './pr-data.service';
import {
  ChatSession,
  SessionType,
} from 'src/version1/chat_management/chat-sessions/chat-sessions.entity';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { Repository as RepoEntity } from '../../pr_management/repositories/repositories.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/version1/user_management/users/users.entity';

@Injectable()
export class PrFetchService {
  private readonly GITHUB_API_BASE = 'https://api.github.com';
  private readonly logger = new Logger(PrFetchService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly prDataService: PrDataService,
    @InjectRepository(PrMetadata)
    private prMetadataRepo: Repository<PrMetadata>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(ChatSession)
    private chatSessionRepo: Repository<ChatSession>,
  ) {}

  /**
   * Parse GitHub PR URL to extract owner, repo, and PR number
   */
  private parsePRUrl(prUrl: string): {
    owner: string;
    repo: string;
    prNumber: string;
  } {
    const match = prUrl.match(
      /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)$/,
    );
    if (!match) {
      throw new BadRequestException('Invalid GitHub PR URL format');
    }

    const [, owner, repo, prNumber] = match;
    return { owner, repo, prNumber };
  }

  /**
   * Make HTTP request to GitHub API
   */
  private async makeGitHubRequest<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PR-Agent-Backend/1.0.0',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new HttpException(
            'PR not found or repository is private',
            HttpStatus.NOT_FOUND,
          );
        }
        if (response.status === 403) {
          throw new HttpException(
            'GitHub API rate limit exceeded',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        throw new HttpException(
          `GitHub API error: ${response.statusText}`,
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch data from GitHub API',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch PR metadata
   */
  private async fetchPRMetadata(
    owner: string,
    repo: string,
    prNumber: string,
  ): Promise<PRMetadata> {
    const url = `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`;
    return await this.makeGitHubRequest<PRMetadata>(url);
  }

  /**
   * Fetch PR reviews
   */
  private async fetchPRReviews(
    owner: string,
    repo: string,
    prNumber: string,
  ): Promise<PRReview[]> {
    const url = `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
    return await this.makeGitHubRequest<PRReview[]>(url);
  }

  /**
   * Fetch PR comments
   */
  private async fetchPRComments(
    owner: string,
    repo: string,
    prNumber: string,
  ): Promise<PRComment[]> {
    const url = `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    return await this.makeGitHubRequest<PRComment[]>(url);
  }

  /**
   * Fetch PR files
   */
  private async fetchPRFiles(
    owner: string,
    repo: string,
    prNumber: string,
  ): Promise<PRFile[]> {
    const url = `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    return await this.makeGitHubRequest<PRFile[]>(url);
  }

  /**
   * Main method to fetch all PR details
   */
  async fetchPRDetails(prUrl: string) {
    const { owner, repo, prNumber } = this.parsePRUrl(prUrl);

    try {
      // Fetch all data in parallel for better performance
      const [metadata, reviews, comments, files] = await Promise.all([
        this.fetchPRMetadata(owner, repo, prNumber),
        this.fetchPRReviews(owner, repo, prNumber),
        this.fetchPRComments(owner, repo, prNumber),
        this.fetchPRFiles(owner, repo, prNumber),
      ]);

      return {
        metadata,
        reviews,
        comments,
        files,
        prNumber,
        owner,
        repo,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch PR details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch PR details and save to database
   */
  async fetchAndSavePRDetails(prUrl: string, userId?: string) {
    const { owner, repo, prNumber } = this.parsePRUrl(prUrl);

    try {
      // Fetch all data in parallel for better performance
      const [metadata, reviews, comments, files] = await Promise.all([
        this.fetchPRMetadata(owner, repo, prNumber),
        this.fetchPRReviews(owner, repo, prNumber),
        this.fetchPRComments(owner, repo, prNumber),
        this.fetchPRFiles(owner, repo, prNumber),
      ]);

      const prData = {
        metadata,
        reviews,
        comments,
        files,
      };

      // Save to database
      const savedData = await this.prDataService.savePrData(
        prData,
        owner,
        repo,
        prNumber,
        userId,
      );
      return {
        fetchedData: prData,
        savedData,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch and save PR details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Analyze PR using LLM - fetches PR details and gets AI review
   */
  async analyzePR(analyzeDto: FetchPRDto, userId?: string): Promise<any> {
    try {
      const prDetails = await this.fetchPRDetails(analyzeDto.pr_url);
      // Then pass to LLM service for analysis
      const review = await this.llmService.reviewPR({
        metadata: prDetails.metadata,
        reviews: prDetails.reviews,
        comments: prDetails.comments,
        files: prDetails.files,
      });

      let sessionType: SessionType;
      let prMetadata: PrMetadata | null = null;
      let repository: RepoEntity | null = null;
      let sessionName: string;
      sessionType = SessionType.PR_SPECIFIC;

      prMetadata = await this.prMetadataRepo.findOne({
        where: {
          pr_number: parseInt(prDetails.prNumber),
          repository: {
            repository_owner: prDetails.owner,
            repository_name: prDetails.repo,
          },
        },
        relations: ['repository'],
      });

      if (!prMetadata) {
        throw new HttpException(
          'PR not found. Please fetch and save the PR details first.',
          HttpStatus.NOT_FOUND,
        );
      }

      sessionName = `Chat about PR #${prMetadata.pr_number}: ${prMetadata.title.substring(0, 50)}...`;

      repository = prMetadata.repository;

      const user = await this.userRepo.findOne({ where: { user_id: userId } });
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const chatSession = this.chatSessionRepo.create({
        session_name: sessionName,
        session_type: sessionType,
        user,
        prMetadata: prMetadata || undefined,
        repository: repository || undefined,
        last_activity: new Date(),
      });

      const savedSession = await this.chatSessionRepo.save(chatSession);

      // Save analysis results to database
      let savedPrSummary;
      try {
        savedPrSummary = await this.prDataService.savePrAnalysis(
          review,
          analyzeDto.pr_url,
          userId,
          'gpt-4o', // You might want to get this from config or LLM service
          // savedSession.session_id
        );
      } catch (saveError) {
        this.logger.warn(
          'Failed to save analysis results to database:',
          saveError,
        );
        // Don't fail the whole request if saving fails
      }

      return  {
        pr_summary_id: savedPrSummary.pr_summary_id,
        summary: review.summary || 'No summary provided',
        issues_found: Array.isArray(review.issues_found)
          ? review.issues_found
          : [],
        suggestions: Array.isArray(review.suggestions)
          ? review.suggestions
          : [],
        test_recommendations: Array.isArray(review.test_recommendations)
          ? review.test_recommendations
          : [],
        overall_score:
          typeof review.overall_score === 'number'
            ? Math.max(1, Math.min(10, review.overall_score))
            : 5,
        security_concerns: Array.isArray(review.security_concerns)
          ? review.security_concerns
          : [],
        performance_issues: Array.isArray(review.performance_issues)
          ? review.performance_issues
          : [],
        well_handled_cases: review.well_handled_cases || [],
        future_enhancements: review.future_enhancements || [],
        code_quality_rating: review.code_quality_rating,
        session_id:savedSession.session_id
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to analyze PR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


}
