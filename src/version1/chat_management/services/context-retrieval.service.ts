import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryType, QueryClassification } from '../types/chat.types';
import { ChatSession } from '../chat-sessions/chat-sessions.entity';
import { PrMetadata } from '../../pr_management/pr-metadata/pr-metadata.entity';
import { Repository as RepoEntity } from '../../pr_management/repositories/repositories.entity';
import { PRFile } from '../../pr_management/pr-files/pr-files.entity';
import { GithubPrReview } from '../../pr_management/github-pr-reviews/github-pr-reviews.entity';
import { PrComment } from '../../pr_management/pr-comments/pr-comments.entity';
import { PrSummary } from '../../pr_management/pr-summary/pr-summary.entity';
import { PRCommit } from '../../pr_management/pr-commits/pr-commits.entity';
import { ChatMessage } from '../chat-messages/chat-messages.entity';

@Injectable()
export class ContextRetrievalService {
  private readonly logger = new Logger(ContextRetrievalService.name);

  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepo: Repository<ChatSession>,
    @InjectRepository(PrMetadata)
    private prMetadataRepo: Repository<PrMetadata>,
    @InjectRepository(RepoEntity)
    private repositoryRepo: Repository<RepoEntity>,
    @InjectRepository(PRFile)
    private prFileRepo: Repository<PRFile>,
    @InjectRepository(GithubPrReview)
    private githubPrReviewRepo: Repository<GithubPrReview>,
    @InjectRepository(PrComment)
    private prCommentRepo: Repository<PrComment>,
    @InjectRepository(PrSummary)
    private prSummaryRepo: Repository<PrSummary>,
    @InjectRepository(PRCommit)
    private prCommitRepo: Repository<PRCommit>,
  ) {}

  async getContextForQuery(
    classification: QueryClassification,
    sessionId: string,
    conversation_history: ChatMessage[]
  ): Promise<{
    context_data: any;
    context_sources: string[];
  }> {
    try {
      // Get session details
      const session = await this.chatSessionRepo.findOne({
        where: { session_id: sessionId },
        relations: ['prMetadata', 'repository', 'user']
      });

      if (!session) {
        throw new HttpException('Chat session not found', HttpStatus.NOT_FOUND);
      }

      const contextSources: string[] = [];
      let contextData: any = {};

      // Fetch context based on query type and classification
      for (const contextType of classification.context_needed) {
        switch (contextType) {
          case 'metadata':
            const metadataContext = await this.fetchMetadataContext(session);
            if (metadataContext) {
              contextData.metadata = metadataContext;
              contextSources.push('metadata');
            }
            break;

          case 'summary':
            const summaryContext = await this.fetchSummaryContext(session);
            if (summaryContext) {
              contextData.summary = summaryContext;
              contextSources.push('summary');
            }
            break;

          case 'files':
            const filesContext = await this.fetchFilesContext(session, classification.specific_filters);
            if (filesContext) {
              contextData.files = filesContext;
              contextSources.push('files');
            }
            break;

          case 'reviews':
            const reviewsContext = await this.fetchReviewsContext(session);
            if (reviewsContext) {
              contextData.reviews = reviewsContext;
              contextSources.push('reviews');
            }
            break;

          case 'comments':
            const commentsContext = await this.fetchCommentsContext(session);
            if (commentsContext) {
              contextData.comments = commentsContext;
              contextSources.push('comments');
            }
            break;

          case 'commits':
            const commitsContext = await this.fetchCommitsContext(session);
            if (commitsContext) {
              contextData.commits = commitsContext;
              contextSources.push('commits');
            }
            break;
        }
      }

      // Add query-specific context based on classification
      if (classification.primary_type === QueryType.SECURITY) {
        const securityContext = await this.fetchSecurityContext(session);
        if (securityContext) {
          contextData.security = securityContext;
          contextSources.push('security_analysis');
        }
      }

      if (classification.primary_type === QueryType.PERFORMANCE) {
        const performanceContext = await this.fetchPerformanceContext(session);
        if (performanceContext) {
          contextData.performance = performanceContext;
          contextSources.push('performance_analysis');
        }
      }

      return {
        context_data: contextData,
        context_sources: contextSources
      };
    } catch (error) {
      this.logger.error('Failed to retrieve context for query:', error);
      throw new HttpException(
        'Failed to retrieve context',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async fetchMetadataContext(session: ChatSession): Promise<any> {
    if (!session.prMetadata) {
      return null;
    }

    try {
      const prMetadata = await this.prMetadataRepo.findOne({
        where: { pr_metadata_id: session.prMetadata.pr_metadata_id },
        relations: ['repository', 'author']
      });

      if (!prMetadata) return null;

      return {
        pr_number: prMetadata.pr_number,
        title: prMetadata.title,
        description: prMetadata.body,
        state: prMetadata.state,
        draft: prMetadata.draft,
        mergeable: prMetadata.mergeable,
        author: {
          login: prMetadata.author.login,
          name: prMetadata.author.name,
          avatar_url: prMetadata.author.avatar_url
        },
        repository: {
          name: prMetadata.repository.repository_name,
          owner: prMetadata.repository.repository_owner,
          description: prMetadata.repository.description,
          default_branch: prMetadata.repository.default_branch
        },
        branches: {
          base: {
            ref: prMetadata.base_ref,
            sha: prMetadata.base_sha
          },
          head: {
            ref: prMetadata.head_ref,
            sha: prMetadata.head_sha
          }
        },
        dates: {
          created_at: prMetadata.github_created_at,
          updated_at: prMetadata.github_updated_at,
          merged_at: prMetadata.merged_at,
          closed_at: prMetadata.closed_at
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch metadata context:', error);
      return null;
    }
  }

  private async fetchSummaryContext(session: ChatSession): Promise<any> {
    if (!session.prMetadata) {
      return null;
    }

    try {
      const summaries = await this.prSummaryRepo.find({
        where: {
          prReview: {
            prMetadata: {
              pr_metadata_id: session.prMetadata.pr_metadata_id
            }
          }
        },
        relations: ['prReview'],
        order: { created_at: 'DESC' },
        take: 1
      });

      if (summaries.length === 0) return null;

      const summary = summaries[0];
      return {
        summary: summary.summary,
        overall_score: summary.overall_score,
        issues_found: summary.issues_found,
        suggestions: summary.suggestions,
        test_recommendations: summary.test_recommendations,
        security_concerns: summary.security_concerns,
        performance_issues: summary.performance_issues,
        well_handled_cases: summary.well_handled_cases,
        future_enhancements: summary.future_enhancements,
        code_quality_rating: summary.code_quality_rating,
        analysis_model: summary.analysis_model,
        analysis_timestamp: summary.analysis_timestamp
      };
    } catch (error) {
      this.logger.error('Failed to fetch summary context:', error);
      return null;
    }
  }

  private async fetchFilesContext(session: ChatSession, filters?: any): Promise<any> {
    if (!session.prMetadata) {
      return null;
    }

    try {
      let queryBuilder = this.prFileRepo.createQueryBuilder('file')
        .where('file.pr_metadata_id = :prMetadataId', {
          prMetadataId: session.prMetadata.pr_metadata_id
        });

      // Apply file name filters if specified
      if (filters?.file_names && filters.file_names.length > 0) {
        queryBuilder = queryBuilder.andWhere(
          'file.file_path ILIKE ANY(ARRAY[:...fileNames])',
          { fileNames: filters.file_names.map((name: string) => `%${name}%`) }
        );
      }

      const files = await queryBuilder
        .orderBy('file.additions + file.deletions', 'DESC')
        .limit(50) // Limit to top 50 files by change size
        .getMany();

      if (files.length === 0) return null;

      return {
        total_files: files.length,
        files: files.map(file => ({
          filename: file.file_path,
          previous_filename: file.previous_file_path,
          change_type: file.change_type,
          additions: file.additions,
          deletions: file.deletions,
          total_changes: file.additions + file.deletions,
          language: file.file_language,
          is_binary: file.is_binary,
          patch_preview: file.patch?.substring(0, 1000) + (file.patch?.length > 1000 ? '...' : ''),
          file_size: file.file_size_bytes
        })),
        summary: {
          total_additions: files.reduce((sum, f) => sum + f.additions, 0),
          total_deletions: files.reduce((sum, f) => sum + f.deletions, 0),
          languages: [...new Set(files.map(f => f.file_language).filter(Boolean))],
          change_types: [...new Set(files.map(f => f.change_type))]
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch files context:', error);
      return null;
    }
  }

  private async fetchReviewsContext(session: ChatSession): Promise<any> {
    if (!session.prMetadata) {
      return null;
    }

    try {
      const reviews = await this.githubPrReviewRepo.find({
        where: { prMetadata: { pr_metadata_id: session.prMetadata.pr_metadata_id } },
        relations: ['reviewer'],
        order: { submitted_at: 'DESC' }
      });

      if (reviews.length === 0) return null;

      return {
        total_reviews: reviews.length,
        reviews: reviews.map(review => ({
          id: review.github_review_id,
          reviewer: {
            login: review.reviewer.login,
            name: review.reviewer.name,
            avatar_url: review.reviewer.avatar_url
          },
          state: review.state,
          body: review.body,
          submitted_at: review.submitted_at,
          commit_sha: review.commit_sha
        })),
        summary: {
          approved_count: reviews.filter(r => r.state === 'APPROVED').length,
          changes_requested_count: reviews.filter(r => r.state === 'CHANGES_REQUESTED').length,
          commented_count: reviews.filter(r => r.state === 'COMMENTED').length,
          reviewers: [...new Set(reviews.map(r => r.reviewer.login))]
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch reviews context:', error);
      return null;
    }
  }

  private async fetchCommentsContext(session: ChatSession): Promise<any> {
    if (!session.prMetadata) {
      return null;
    }

    try {
      const comments = await this.prCommentRepo.find({
        where: { prMetadata: { pr_metadata_id: session.prMetadata.pr_metadata_id } },
        relations: ['author'],
        order: { github_created_at: 'DESC' },
        take: 50 // Limit to recent 50 comments
      });

      if (comments.length === 0) return null;

      return {
        total_comments: comments.length,
        comments: comments.map(comment => ({
          id: comment.github_comment_id,
          author: {
            login: comment.author.login,
            name: comment.author.name,
            avatar_url: comment.author.avatar_url
          },
          body: comment.body,
          created_at: comment.github_created_at,
          updated_at: comment.github_updated_at,
          path: comment.path,
          line: comment.line,
          side: comment.side
        })),
        summary: {
          commenters: [...new Set(comments.map(c => c.author.login))],
          file_specific_comments: comments.filter(c => c.path).length,
          general_comments: comments.filter(c => !c.path).length
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch comments context:', error);
      return null;
    }
  }

  private async fetchCommitsContext(session: ChatSession): Promise<any> {
    if (!session.prMetadata) {
      return null;
    }

    try {
      const commits = await this.prCommitRepo.find({
        where: { prMetadata: { pr_metadata_id: session.prMetadata.pr_metadata_id } },
        relations: ['githubAuthor'],
        order: { committed_at: 'DESC' }
      });

      if (commits.length === 0) return null;

      return {
        total_commits: commits.length,
        commits: commits.map(commit => ({
          sha: commit.commit_sha,
          message: commit.message,
          author: commit.author,
          author_email: commit.author_email,
          committed_at: commit.committed_at,
          additions: commit.additions,
          deletions: commit.deletions,
          verified: commit.verified,
          github_author: commit.githubAuthor ? {
            login: commit.githubAuthor.login,
            avatar_url: commit.githubAuthor.avatar_url
          } : null
        })),
        summary: {
          total_additions: commits.reduce((sum, c) => sum + c.additions, 0),
          total_deletions: commits.reduce((sum, c) => sum + c.deletions, 0),
          authors: [...new Set(commits.map(c => c.author))],
          verified_commits: commits.filter(c => c.verified).length
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch commits context:', error);
      return null;
    }
  }

  private async fetchSecurityContext(session: ChatSession): Promise<any> {
    try {
      const summaryContext = await this.fetchSummaryContext(session);
      if (!summaryContext) return null;

      return {
        security_concerns: summaryContext.security_concerns || [],
        overall_security_score: this.calculateSecurityScore(summaryContext.security_concerns),
        recommendations: summaryContext.suggestions?.filter((suggestion: string) =>
          suggestion.toLowerCase().includes('security') ||
          suggestion.toLowerCase().includes('auth') ||
          suggestion.toLowerCase().includes('encrypt')
        ) || []
      };
    } catch (error) {
      this.logger.error('Failed to fetch security context:', error);
      return null;
    }
  }

  private async fetchPerformanceContext(session: ChatSession): Promise<any> {
    try {
      const summaryContext = await this.fetchSummaryContext(session);
      if (!summaryContext) return null;

      return {
        performance_issues: summaryContext.performance_issues || [],
        performance_score: summaryContext.code_quality_rating?.scalability || 0,
        recommendations: summaryContext.suggestions?.filter((suggestion: string) =>
          suggestion.toLowerCase().includes('performance') ||
          suggestion.toLowerCase().includes('optimization') ||
          suggestion.toLowerCase().includes('efficiency')
        ) || []
      };
    } catch (error) {
      this.logger.error('Failed to fetch performance context:', error);
      return null;
    }
  }

  private calculateSecurityScore(securityConcerns: string[]): number {
    if (!securityConcerns || securityConcerns.length === 0) return 10;

    // Simple scoring: reduce score based on number and severity of concerns
    let score = 10;
    securityConcerns.forEach(concern => {
      const lowerConcern = concern.toLowerCase();
      if (lowerConcern.includes('critical') || lowerConcern.includes('high')) {
        score -= 3;
      } else if (lowerConcern.includes('medium')) {
        score -= 2;
      } else {
        score -= 1;
      }
    });

    return Math.max(0, score);
  }

  // Method to get repository-wide context for repository sessions
  async getRepositoryContext(repositoryId: string): Promise<any> {
    try {
      const repository = await this.repositoryRepo.findOne({
        where: { repository_id: repositoryId },
        relations: ['prMetadata', 'prMetadata.author']
      });

      if (!repository) return null;

      const recentPRs = repository.prMetadata
        ?.sort((a, b) => b.github_updated_at.getTime() - a.github_updated_at.getTime())
        .slice(0, 10);

      return {
        repository: {
          name: repository.repository_name,
          owner: repository.repository_owner,
          description: repository.description,
          topics: repository.topics,
          stars: repository.stars,
          forks: repository.forks,
          default_branch: repository.default_branch,
          is_private: repository.is_private
        },
        recent_prs: recentPRs?.map(pr => ({
          number: pr.pr_number,
          title: pr.title,
          state: pr.state,
          author: pr.author.login,
          created_at: pr.github_created_at,
          updated_at: pr.github_updated_at
        })) || [],
        stats: {
          total_prs: repository.prMetadata?.length || 0,
          open_prs: repository.prMetadata?.filter(pr => pr.state === 'open').length || 0,
          merged_prs: repository.prMetadata?.filter(pr => pr.state === 'merged').length || 0
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch repository context:', error);
      return null;
    }
  }
}