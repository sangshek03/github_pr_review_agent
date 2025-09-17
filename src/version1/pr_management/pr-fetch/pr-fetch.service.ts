import { Injectable, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PRMetadata, PRReview, PRComment, PRFile, AnalyzeDTO, FetchPRDto } from './pr-fetch.dto';
import { LlmService, PRReviewResponse } from '../llm/llm.service';
import { PrDataService } from './pr-data.service';

@Injectable()
export class PrFetchService {
  private readonly GITHUB_API_BASE = 'https://api.github.com';
  private readonly logger = new Logger(PrFetchService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly prDataService: PrDataService,
  ) {}

  /**
   * Parse GitHub PR URL to extract owner, repo, and PR number
   */
  private parsePRUrl(prUrl: string): { owner: string; repo: string; prNumber: string } {
    const match = prUrl.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)$/);
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
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PR-Agent-Backend/1.0.0',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new HttpException('PR not found or repository is private', HttpStatus.NOT_FOUND);
        }
        if (response.status === 403) {
          throw new HttpException('GitHub API rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
        }
        throw new HttpException(
          `GitHub API error: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch data from GitHub API',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Fetch PR metadata
   */
  private async fetchPRMetadata(owner: string, repo: string, prNumber: string): Promise<PRMetadata> {
    const url = `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`;
    return await this.makeGitHubRequest<PRMetadata>(url);
  }

  /**
   * Fetch PR reviews
   */
  private async fetchPRReviews(owner: string, repo: string, prNumber: string): Promise<PRReview[]> {
    const url = `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
    return await this.makeGitHubRequest<PRReview[]>(url);
  }

  /**
   * Fetch PR comments
   */
  private async fetchPRComments(owner: string, repo: string, prNumber: string): Promise<PRComment[]> {
    const url = `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    return await this.makeGitHubRequest<PRComment[]>(url);
  }

  /**
   * Fetch PR files
   */
  private async fetchPRFiles(owner: string, repo: string, prNumber: string): Promise<PRFile[]> {
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
      const savedData = await this.prDataService.savePrData(prData, owner, repo, prNumber, userId);

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
  async analyzePR(analyzeDto: FetchPRDto, userId?: string): Promise<PRReviewResponse> {
    try {
      const prDetails = await this.fetchPRDetails(analyzeDto.pr_url);
      // Then pass to LLM service for analysis
      const review = await this.llmService.reviewPR({
        metadata: prDetails.metadata,
        reviews: prDetails.reviews,
        comments: prDetails.comments,
        files: prDetails.files,
      });

      // Save analysis results to database
      try {
        await this.prDataService.savePrAnalysis(
          review,
          analyzeDto.pr_url,
          userId,
          'gpt-4o' // You might want to get this from config or LLM service
        );
      } catch (saveError) {
        this.logger.warn('Failed to save analysis results to database:', saveError);
        // Don't fail the whole request if saving fails
      }
      
      return review;
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