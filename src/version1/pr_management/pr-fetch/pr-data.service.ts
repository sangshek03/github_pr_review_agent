import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Repository as RepoEntity } from '../repositories/repositories.entity';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { GithubUser } from '../github-users/github-users.entity';
import { GithubPrReview } from '../github-pr-reviews/github-pr-reviews.entity';
import { PrComment } from '../pr-comments/pr-comments.entity';
import { PRFile } from '../pr-files/pr-files.entity';
import { PRCommit } from '../pr-commits/pr-commits.entity';
import { PrLabel } from '../pr-labels/pr-labels.entity';
import { PRReview, PRReviewStatus } from '../pr-reviews/pr-reviews.entity';
import { User } from '../../user_management/users/users.entity';
import { PrSummary } from '../pr-summary/pr-summary.entity';
import { PRReviewResponse } from '../llm/llm.service';
import { ChatSession } from 'src/version1/chat_management/chat-sessions/chat-sessions.entity';

@Injectable()
export class PrDataService {
  private readonly logger = new Logger(PrDataService.name);

  constructor(
    @InjectRepository(RepoEntity)
    private repositoryRepo: Repository<RepoEntity>,
    @InjectRepository(PrMetadata)
    private prMetadataRepo: Repository<PrMetadata>,
    @InjectRepository(GithubUser)
    private githubUserRepo: Repository<GithubUser>,
    @InjectRepository(ChatSession)
    private sessionRepo: Repository<ChatSession>,
    @InjectRepository(GithubPrReview)
    private githubPrReviewRepo: Repository<GithubPrReview>,
    @InjectRepository(PrComment)
    private prCommentRepo: Repository<PrComment>,
    @InjectRepository(PRFile)
    private prFileRepo: Repository<PRFile>,
    @InjectRepository(PRCommit)
    private prCommitRepo: Repository<PRCommit>,
    @InjectRepository(PrLabel)
    private prLabelRepo: Repository<PrLabel>,
    @InjectRepository(PRReview)
    private prReviewRepo: Repository<PRReview>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(PrSummary)
    private prSummaryRepo: Repository<PrSummary>,
  ) {}

  /**
   * Save or update GitHub user
   */
  private async upsertGithubUser(userData: any): Promise<GithubUser> {
    try {
      let githubUser = await this.githubUserRepo.findOne({
        where: { github_id: userData.id }
      });

      if (!githubUser) {
        githubUser = this.githubUserRepo.create({
          github_id: userData.id,
          login: userData.login,
          avatar_url: userData.avatar_url,
          name: userData.name,
          email: userData.email,
          company: userData.company,
          bio: userData.bio,
        });
      } else {
        // Update existing user
        githubUser.login = userData.login;
        githubUser.avatar_url = userData.avatar_url;
        githubUser.name = userData.name;
        githubUser.email = userData.email;
        githubUser.company = userData.company;
        githubUser.bio = userData.bio;
      }

      return await this.githubUserRepo.save(githubUser);
    } catch (error) {
      this.logger.error(`Failed to upsert GitHub user ${userData.login}:`, error);
      throw new HttpException(
        'Failed to save GitHub user data',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Save or update repository
   */
  private async upsertRepository(repoData: any): Promise<RepoEntity> {
    try {
      let repository = await this.repositoryRepo.findOne({
        where: { github_repo_id: repoData.id }
      });

      if (!repository) {
        repository = this.repositoryRepo.create({
          github_repo_id: repoData.id,
          repository_name: repoData.name,
          repository_owner: repoData.owner.login,
          repository_url: repoData.html_url,
          default_branch: repoData.default_branch || 'main',
          is_private: repoData.private || false,
          is_fork: repoData.fork || false,
          is_archived: repoData.archived || false,
          topics: repoData.topics || [],
          homepage: repoData.homepage,
          size: repoData.size,
          languages: {},
          metadata: {},
          description: repoData.description || '',
          stars: repoData.stargazers_count || 0,
          forks: repoData.forks_count || 0,
          watchers: repoData.watchers_count || 0,
          last_synced_at: new Date(),
        });
      } else {
        // Update existing repository
        repository.repository_name = repoData.name;
        repository.repository_owner = repoData.owner.login;
        repository.repository_url = repoData.html_url;
        repository.default_branch = repoData.default_branch || 'main';
        repository.is_private = repoData.private || false;
        repository.is_fork = repoData.fork || false;
        repository.is_archived = repoData.archived || false;
        repository.topics = repoData.topics || [];
        repository.homepage = repoData.homepage;
        repository.size = repoData.size;
        repository.description = repoData.description || '';
        repository.stars = repoData.stargazers_count || 0;
        repository.forks = repoData.forks_count || 0;
        repository.watchers = repoData.watchers_count || 0;
        repository.last_synced_at = new Date();
      }

      return await this.repositoryRepo.save(repository);
    } catch (error) {
      this.logger.error(`Failed to upsert repository ${repoData.name}:`, error);
      throw new HttpException(
        'Failed to save repository data',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Save or update PR metadata
   */
  private async upsertPrMetadata(
    prData: any,
    repository: RepoEntity,
    author: GithubUser
  ): Promise<PrMetadata> {
    try {
      let prMetadata = await this.prMetadataRepo.findOne({
        where: {
          repository: { repository_id: repository.repository_id },
          pr_number: prData.number
        }
      });

      const state = prData.merged_at ? 'merged' : prData.state;

      if (!prMetadata) {
        prMetadata = this.prMetadataRepo.create({
          github_pr_id: prData.id,
          pr_number: prData.number,
          title: prData.title,
          body: prData.body,
          state: state,
          draft: prData.draft || false,
          mergeable: prData.mergeable,
          merged_at: prData.merged_at ? new Date(prData.merged_at) : null,
          closed_at: prData.closed_at ? new Date(prData.closed_at) : null,
          base_ref: prData.base.ref,
          base_sha: prData.base.sha,
          head_ref: prData.head.ref,
          head_sha: prData.head.sha,
          github_created_at: new Date(prData.created_at),
          github_updated_at: new Date(prData.updated_at),
          repository,
          author,
        });
      } else {
        // Update existing PR metadata
        prMetadata.title = prData.title;
        prMetadata.body = prData.body;
        prMetadata.state = state;
        prMetadata.draft = prData.draft || false;
        prMetadata.mergeable = prData.mergeable;
        prMetadata.merged_at = prData.merged_at ? new Date(prData.merged_at) : null;
        prMetadata.closed_at = prData.closed_at ? new Date(prData.closed_at) : null;
        prMetadata.base_ref = prData.base.ref;
        prMetadata.base_sha = prData.base.sha;
        prMetadata.head_ref = prData.head.ref;
        prMetadata.head_sha = prData.head.sha;
        prMetadata.github_updated_at = new Date(prData.updated_at);
      }

      return await this.prMetadataRepo.save(prMetadata);
    } catch (error) {
      this.logger.error(`Failed to upsert PR metadata ${prData.number}:`, error);
      throw new HttpException(
        'Failed to save PR metadata',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Save PR reviews from GitHub
   */
  private async savePrReviews(
    reviewsData: any[],
    prMetadata: PrMetadata
  ): Promise<GithubPrReview[]> {
    try {
      const reviews: GithubPrReview[] = [];

      for (const reviewData of reviewsData) {
        // First ensure the reviewer user exists
        const reviewer = await this.upsertGithubUser(reviewData.user);

        let githubReview = await this.githubPrReviewRepo.findOne({
          where: { github_review_id: reviewData.id }
        });

        if (!githubReview) {
          githubReview = this.githubPrReviewRepo.create({
            github_review_id: reviewData.id,
            body: reviewData.body,
            state: reviewData.state,
            submitted_at: reviewData.submitted_at ? new Date(reviewData.submitted_at) : null,
            commit_sha: reviewData.commit_id,
            prMetadata,
            reviewer,
          });
        } else {
          githubReview.body = reviewData.body;
          githubReview.state = reviewData.state;
          githubReview.submitted_at = reviewData.submitted_at ? new Date(reviewData.submitted_at) : null;
          githubReview.commit_sha = reviewData.commit_id;
        }

        const savedReview = await this.githubPrReviewRepo.save(githubReview);
        reviews.push(savedReview);
      }

      return reviews;
    } catch (error) {
      this.logger.error('Failed to save PR reviews:', error);
      throw new HttpException(
        'Failed to save PR reviews',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Save PR comments
   */
  private async savePrComments(
    commentsData: any[],
    prMetadata: PrMetadata
  ): Promise<PrComment[]> {
    try {
      const comments: PrComment[] = [];

      for (const commentData of commentsData) {
        const author = await this.upsertGithubUser(commentData.user);

        let prComment = await this.prCommentRepo.findOne({
          where: { github_comment_id: commentData.id }
        });

        if (!prComment) {
          prComment = this.prCommentRepo.create({
            github_comment_id: commentData.id,
            body: commentData.body,
            path: commentData.path,
            line: commentData.line,
            side: commentData.side,
            in_reply_to_id: commentData.in_reply_to_id,
            github_created_at: new Date(commentData.created_at),
            github_updated_at: new Date(commentData.updated_at),
            prMetadata,
            author,
          });
        } else {
          prComment.body = commentData.body;
          prComment.path = commentData.path;
          prComment.line = commentData.line;
          prComment.side = commentData.side;
          prComment.github_updated_at = new Date(commentData.updated_at);
        }

        const savedComment = await this.prCommentRepo.save(prComment);
        comments.push(savedComment);
      }

      return comments;
    } catch (error) {
      this.logger.error('Failed to save PR comments:', error);
      throw new HttpException(
        'Failed to save PR comments',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Save PR files
   */
  private async savePrFiles(
    filesData: any[],
    prMetadata: PrMetadata
  ): Promise<PRFile[]> {
    try {
      const files: PRFile[] = [];

      for (const fileData of filesData) {
        let prFile = await this.prFileRepo.findOne({
          where: {
            prMetadata: { pr_metadata_id: prMetadata.pr_metadata_id },
            file_path: fileData.filename
          }
        });

        if (!prFile) {
          prFile = this.prFileRepo.create({
            file_path: fileData.filename,
            previous_file_path: fileData.previous_filename,
            change_type: fileData.status,
            additions: fileData.additions || 0,
            deletions: fileData.deletions || 0,
            patch: fileData.patch,
            file_language: this.detectLanguage(fileData.filename),
            file_size_bytes: fileData.changes || 0,
            blob_sha: fileData.blob_url ? this.extractShaFromUrl(fileData.blob_url) : null,
            raw_url: fileData.raw_url,
            contents_url: fileData.contents_url,
            patch_size_bytes: fileData.patch ? fileData.patch.length : null,
            is_binary: this.isBinaryFile(fileData.filename),
            prMetadata,
          });
        } else {
          prFile.previous_file_path = fileData.previous_filename;
          prFile.change_type = fileData.status;
          prFile.additions = fileData.additions || 0;
          prFile.deletions = fileData.deletions || 0;
          prFile.patch = fileData.patch;
          prFile.file_language = this.detectLanguage(fileData.filename);
          prFile.file_size_bytes = fileData.changes || 0;
          prFile.blob_sha = fileData.blob_url ? this.extractShaFromUrl(fileData.blob_url) : null;
          prFile.raw_url = fileData.raw_url;
          prFile.contents_url = fileData.contents_url;
          prFile.patch_size_bytes = fileData.patch ? fileData.patch.length : null;
          prFile.is_binary = this.isBinaryFile(fileData.filename);
        }

        const savedFile = await this.prFileRepo.save(prFile);
        files.push(savedFile);
      }

      return files;
    } catch (error) {
      this.logger.error('Failed to save PR files:', error);
      throw new HttpException(
        'Failed to save PR files',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Save PR commits (fetch from GitHub API)
   */
  private async savePrCommits(
    owner: string,
    repo: string,
    prNumber: string,
    prMetadata: PrMetadata
  ): Promise<PRCommit[]> {
    try {
      // Fetch commits from GitHub API
      const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits`;
      const response = await fetch(commitsUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PR-Agent-Backend/1.0.0',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch commits for PR ${prNumber}: ${response.statusText}`);
        return [];
      }

      const commitsData = await response.json();
      const commits: PRCommit[] = [];

      for (const commitData of commitsData) {
        const author = commitData.author ? await this.upsertGithubUser(commitData.author) : null;

        let prCommit = await this.prCommitRepo.findOne({
          where: { commit_sha: commitData.sha }
        });

        if (!prCommit) {
          prCommit = this.prCommitRepo.create({
            commit_sha: commitData.sha,
            message: commitData.commit.message,
            author: commitData.commit.author.name,
            author_email: commitData.commit.author.email,
            committed_at: new Date(commitData.commit.author.date),
            parent_sha: commitData.parents.length > 0 ? commitData.parents[0].sha : null,
            commit_url: commitData.html_url,
            additions: commitData.stats?.additions || 0,
            deletions: commitData.stats?.deletions || 0,
            tree_sha: commitData.commit.tree.sha,
            verified: commitData.commit.verification?.verified || false,
            verification_reason: commitData.commit.verification?.reason,
            prMetadata,
            githubAuthor: author,
          });
        } else {
          prCommit.message = commitData.commit.message;
          prCommit.author = commitData.commit.author.name;
          prCommit.author_email = commitData.commit.author.email;
          prCommit.committed_at = new Date(commitData.commit.author.date);
          prCommit.parent_sha = commitData.parents.length > 0 ? commitData.parents[0].sha : null;
          prCommit.commit_url = commitData.html_url;
          prCommit.additions = commitData.stats?.additions || 0;
          prCommit.deletions = commitData.stats?.deletions || 0;
          prCommit.tree_sha = commitData.commit.tree.sha;
          prCommit.verified = commitData.commit.verification?.verified || false;
          prCommit.verification_reason = commitData.commit.verification?.reason;
        }

        const savedCommit = await this.prCommitRepo.save(prCommit);
        commits.push(savedCommit);
      }

      return commits;
    } catch (error) {
      this.logger.error('Failed to save PR commits:', error);
      // Don't throw error for commits as they're not critical
      return [];
    }
  }

  /**
   * Main method to save all PR data
   */
  async savePrData(
    prData: {
      metadata: any;
      reviews: any[];
      comments: any[];
      files: any[];
    },
    owner: string,
    repo: string,
    prNumber: string,
    userId?: string
  ) {
    this.logger.log(`Starting to save PR data for ${owner}/${repo}#${prNumber}`);

    try {
      // 1. Save repository
      const repository = await this.upsertRepository(prData.metadata.base.repo);

      // 2. Save PR author
      const author = await this.upsertGithubUser(prData.metadata.user);

      // 3. Save PR metadata
      const prMetadata = await this.upsertPrMetadata(prData.metadata, repository, author);

      // 4. Save PR reviews, comments, files, and commits in parallel
      const [reviews, comments, files, commits] = await Promise.all([
        this.savePrReviews(prData.reviews, prMetadata),
        this.savePrComments(prData.comments, prMetadata),
        this.savePrFiles(prData.files, prMetadata),
        this.savePrCommits(owner, repo, prNumber, prMetadata),
      ]);

      // 6. Create PR review entry if user is provided
      let prReview;
      if (userId) {
        const user = await this.userRepo.findOne({ where: { user_id: userId } });
        if (user) {
          prReview = await this.createPrReview(prMetadata, repository, user, prData.metadata);
        }
      }

      this.logger.log(`Successfully saved PR data for ${owner}/${repo}#${prNumber}`);

      return {
        prMetadata,
        repository,
        author,
        reviews,
        comments,
        files,
        commits,
        prReview,
      };
    } catch (error) {
      this.logger.error(`Failed to save PR data for ${owner}/${repo}#${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * Create PR review entry for user
   */
  private async createPrReview(
    prMetadata: PrMetadata,
    repository: RepoEntity,
    user: User,
    githubPrData: any
  ): Promise<PRReview> {
    try {
      // Check if PR review already exists for this user and PR
      let prReview = await this.prReviewRepo.findOne({
        where: {
          prMetadata: { pr_metadata_id: prMetadata.pr_metadata_id },
          user: { user_id: user.user_id }
        }
      });

      if (!prReview) {
        prReview = this.prReviewRepo.create({
          pr_url: githubPrData.html_url,
          status: PRReviewStatus.COMPLETED,
          files_changed: githubPrData.changed_files || 0,
          additions: githubPrData.additions || 0,
          deletions: githubPrData.deletions || 0,
          summary: `PR #${prMetadata.pr_number}: ${prMetadata.title}`,
          analysis_completed_at: new Date(),
          total_findings: 0,
          high_severity_count: 0,
          medium_severity_count: 0,
          low_severity_count: 0,
          user,
          repository,
          prMetadata,
        });

        return await this.prReviewRepo.save(prReview);
      }

      return prReview;
    } catch (error) {
      this.logger.error('Failed to create PR review:', error);
      throw new HttpException(
        'Failed to create PR review',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get user's saved PRs
   */
  async getUserPRs(userId: string): Promise<any[]> {
    try {
      const prReviews = await this.prReviewRepo.find({
        where: { user: { user_id: userId } },
        relations: [
          'prMetadata',
          'prMetadata.repository',
          'prMetadata.author',
          'prMetadata.githubPrReviews',
          'prMetadata.githubPrReviews.reviewer',
          'prMetadata.prComments',
          'prMetadata.prComments.author',
          'prMetadata.prFiles',
          'prMetadata.prCommits',
          'prMetadata.prCommits.githubAuthor',
          'repository'
        ],
        order: { created_at: 'DESC' }
      });

      return prReviews.map(review => ({
        pr_review_id: review.pr_review_id,
        pr_url: review.pr_url,
        status: review.status,
        files_changed: review.files_changed,
        additions: review.additions,
        deletions: review.deletions,
        summary: review.summary,
        created_at: review.created_at,
        updated_at: review.updated_at,
        metadata: {
          id: review.prMetadata.github_pr_id,
          number: review.prMetadata.pr_number,
          title: review.prMetadata.title,
          body: review.prMetadata.body,
          state: review.prMetadata.state,
          created_at: review.prMetadata.github_created_at.toISOString(),
          updated_at: review.prMetadata.github_updated_at.toISOString(),
          closed_at: review.prMetadata.closed_at?.toISOString() || null,
          merged_at: review.prMetadata.merged_at?.toISOString() || null,
          user: {
            login: review.prMetadata.author.login,
            avatar_url: review.prMetadata.author.avatar_url,
          },
          assignees: [], // TODO: Implement if needed
          labels: [], // TODO: Implement if needed
          base: {
            ref: review.prMetadata.base_ref,
            sha: review.prMetadata.base_sha,
          },
          head: {
            ref: review.prMetadata.head_ref,
            sha: review.prMetadata.head_sha,
          },
        },
        reviews: review.prMetadata.githubPrReviews?.map(ghReview => ({
          id: ghReview.github_review_id,
          user: {
            login: ghReview.reviewer.login,
            avatar_url: ghReview.reviewer.avatar_url,
          },
          body: ghReview.body,
          state: ghReview.state,
          submitted_at: ghReview.submitted_at?.toISOString() || null,
        })) || [],
        comments: review.prMetadata.prComments?.map(comment => ({
          id: comment.github_comment_id,
          user: {
            login: comment.author.login,
            avatar_url: comment.author.avatar_url,
          },
          body: comment.body,
          created_at: comment.github_created_at.toISOString(),
          updated_at: comment.github_updated_at.toISOString(),
        })) || [],
        files: review.prMetadata.prFiles?.map(file => ({
          filename: file.file_path,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.additions + file.deletions,
          status: file.change_type,
          patch: file.patch,
        })) || [],
        repository: {
          name: review.prMetadata.repository.repository_name,
          owner: review.prMetadata.repository.repository_owner,
          url: review.prMetadata.repository.repository_url,
        }
      }));
    } catch (error) {
      this.logger.error(`Failed to get user PRs for user ${userId}:`, error);
      throw new HttpException(
        'Failed to get user PRs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Helper methods
   */
  private detectLanguage(filename: string): string | null {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension) return null;

    const languageMap: { [key: string]: string } = {
      'ts': 'TypeScript',
      'js': 'JavaScript',
      'py': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'rb': 'Ruby',
      'php': 'PHP',
      'go': 'Go',
      'rs': 'Rust',
      'kt': 'Kotlin',
      'swift': 'Swift',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'less': 'LESS',
      'json': 'JSON',
      'xml': 'XML',
      'yml': 'YAML',
      'yaml': 'YAML',
      'md': 'Markdown',
      'sql': 'SQL',
    };
    return languageMap[extension] || 'Unknown';
  }

  private isBinaryFile(filename: string): boolean {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
      '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.avi', '.mov', '.wav',
      '.ttf', '.woff', '.woff2', '.eot'
    ];

    const lowerFilename = filename.toLowerCase();
    return binaryExtensions.some(ext => lowerFilename.endsWith(ext));
  }

  private extractShaFromUrl(url: string): string | null {
    const match = url.match(/blob\/([a-f0-9]{40})\//);
    return match ? match[1] : null;
  }

  /**
   * Save PR analysis results to pr-summary table
   */
  async savePrAnalysis(
    analysisResults: PRReviewResponse,
    prUrl: string,
    userId?: string,
    analysisModel?: string,
    // session_id?:string
  ): Promise<PrSummary> {
    try {
      // Find the PR review by URL
      const prReview = await this.prReviewRepo.findOne({
        where: { pr_url: prUrl },
        relations: ['user']
      });

      if (!prReview) {
        throw new HttpException(
          'PR review not found for the given URL',
          HttpStatus.NOT_FOUND
        );
      }

      // Find user if userId provided
      let user;
      if (userId) {
        user = await this.userRepo.findOne({ where: { user_id: userId } });
      }

      // let session;
      // if(session_id){
      //   session = await this.sessionRepo.findOne({where:{session_id:session_id}});
      // }

      // Create new pr-summary entry
      const prSummary = this.prSummaryRepo.create({
        summary: analysisResults.summary,
        issues_found: analysisResults.issues_found,
        suggestions: analysisResults.suggestions,
        test_recommendations: analysisResults.test_recommendations,
        overall_score: analysisResults.overall_score,
        security_concerns: analysisResults.security_concerns,
        performance_issues: analysisResults.performance_issues,
        well_handled_cases: analysisResults.well_handled_cases,
        future_enhancements: analysisResults.future_enhancements,
        code_quality_rating: analysisResults.code_quality_rating,
        analysis_model: analysisModel,
        analysis_timestamp: new Date(),
        user: user || prReview.user,
        prReview: prReview,
        // chatSession:session
      });

      const savedSummary = await this.prSummaryRepo.save(prSummary);

      this.logger.log(`Successfully saved PR analysis for PR: ${prUrl}`);
      return savedSummary;

    } catch (error) {
      this.logger.error(`Failed to save PR analysis for ${prUrl}:`, error);
      throw error;
    }
  }

  /**
   * Get all PR summaries by user ID
   */
  async getAllPrSummariesByUserId(userId: string): Promise<PRReviewResponse[]> {
    try {
      const prSummaries = await this.prSummaryRepo.find({
        where: { user: { user_id: userId } },
        relations: ['prReview', 'prReview.prMetadata', 'user', 'chatSession'],
        order: { created_at: 'DESC' }
      });

      return prSummaries.map(summary => ({
        pr_summary_id: summary.pr_summary_id,
        summary: summary.summary,
        issues_found: summary.issues_found,
        suggestions: summary.suggestions,
        test_recommendations: summary.test_recommendations,
        overall_score: summary.overall_score,
        security_concerns: summary.security_concerns,
        performance_issues: summary.performance_issues,
        well_handled_cases: summary.well_handled_cases,
        future_enhancements: summary.future_enhancements,
        code_quality_rating: summary.code_quality_rating,
        session_id: summary.chatSession?.session_id ?? null, 
      }));

    } catch (error) {
      this.logger.error(`Failed to get PR summaries for user ${userId}:`, error);
      throw new HttpException(
        'Failed to get PR summaries',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get specific PR summary by pr_summary_id
   */
  async getPrSummaryById(prSummaryId: string, userId: string): Promise<PRReviewResponse> {
    try {
      const prSummary = await this.prSummaryRepo.findOne({
        where: {
          pr_summary_id: prSummaryId,
          user: { user_id: userId }
        },
        relations: ['prReview', 'prReview.prMetadata', 'user', 'chatSession']
      });

      if (!prSummary) {
        throw new HttpException(
          'PR summary not found',
          HttpStatus.NOT_FOUND
        );
      }

      return {
        pr_summary_id: prSummary.pr_summary_id,
        summary: prSummary.summary,
        issues_found: prSummary.issues_found,
        suggestions: prSummary.suggestions,
        test_recommendations: prSummary.test_recommendations,
        overall_score: prSummary.overall_score,
        security_concerns: prSummary.security_concerns,
        performance_issues: prSummary.performance_issues,
        well_handled_cases: prSummary.well_handled_cases,
        future_enhancements: prSummary.future_enhancements,
        code_quality_rating: prSummary.code_quality_rating,
        chatSession:prSummary.chatSession?.session_id
      };

    } catch (error) {
      this.logger.error(`Failed to get PR summary ${prSummaryId} for user ${userId}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get PR summary',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}