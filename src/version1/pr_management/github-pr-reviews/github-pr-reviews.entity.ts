import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { GithubUser } from '../github-users/github-users.entity';

export enum GithubReviewState {
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  COMMENTED = 'COMMENTED',
  DISMISSED = 'DISMISSED',
  PENDING = 'PENDING',
}

@Entity({ name: 'github_pr_reviews' })
@Unique(['github_review_id'])
@Index(['github_review_id'])
@Index(['state'])
@Index(['submitted_at'])
export class GithubPrReview {
  @PrimaryGeneratedColumn('uuid')
  github_pr_review_id: string;

  @Column({ type: 'bigint', unique: true })
  github_review_id: number;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({ type: 'enum', enum: GithubReviewState })
  state: GithubReviewState;

  @Column({ type: 'timestamp', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  commit_sha: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  // Relations
  @ManyToOne(() => PrMetadata, (prMetadata) => prMetadata.githubPrReviews, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pr_metadata_id' })
  prMetadata: PrMetadata;

  @ManyToOne(() => GithubUser, (githubUser) => githubUser.githubPrReviews, {
    cascade: ['insert', 'update'],
    onDelete: 'RESTRICT'
  })
  @JoinColumn({ name: 'reviewer_github_user_id' })
  reviewer: GithubUser;
}