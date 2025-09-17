import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user_management/users/users.entity';
import { Repository } from '../repositories/repositories.entity';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { ReviewFinding } from '../review-findings/review-findings.entity';
import { PRFile } from '../pr-files/pr-files.entity';
import { PRCommit } from '../pr-commits/pr-commits.entity';
import { PrSummary } from '../pr-summary/pr-summary.entity';

export enum PRReviewStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity({ schema: 'githubagent', name: 'pr_reviews' })
export class PRReview {
  @PrimaryGeneratedColumn('uuid')
  pr_review_id: string;

  @Column({ type: 'varchar', unique: true })
  pr_url: string;

  @Column({ type: 'enum', enum: PRReviewStatus })
  status: PRReviewStatus;

  @Column({ type: 'int' })
  files_changed: number;

  @Column({ type: 'int' })
  additions: number;

  @Column({ type: 'int' })
  deletions: number;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  analysis_version: string;

  @Column({ type: 'jsonb', nullable: true })
  analysis_config: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  analysis_started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  analysis_completed_at: Date;

  @Column({ type: 'int', default: 0 })
  total_findings: number;

  @Column({ type: 'int', default: 0 })
  high_severity_count: number;

  @Column({ type: 'int', default: 0 })
  medium_severity_count: number;

  @Column({ type: 'int', default: 0 })
  low_severity_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Repository, (repository) => repository.prReviews)
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @ManyToOne(() => PrMetadata, (prMetadata) => prMetadata.prReviews, {
    cascade: ['insert', 'update'],
    onDelete: 'RESTRICT'
  })
  @JoinColumn({ name: 'pr_metadata_id' })
  prMetadata: PrMetadata;

  @OneToMany(() => ReviewFinding, (reviewFinding) => reviewFinding.prReview)
  reviewFindings: ReviewFinding[];


  @OneToMany(() => PRFile, (prFile) => prFile.prReview)
  prFiles: PRFile[];

  @OneToMany(() => PRCommit, (prCommit) => prCommit.prReview)
  prCommits: PRCommit[];

  @OneToMany(() => PrSummary, (prSummary) => prSummary.prReview)
  prSummaries: PrSummary[];
}
