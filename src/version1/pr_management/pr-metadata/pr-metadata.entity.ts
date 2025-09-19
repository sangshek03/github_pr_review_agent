import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
  Unique,
} from 'typeorm';
import { Repository } from '../repositories/repositories.entity';
import { GithubUser } from '../github-users/github-users.entity';
import { PRReview } from '../pr-reviews/pr-reviews.entity';
import { GithubPrReview } from '../github-pr-reviews/github-pr-reviews.entity';
import { PrComment } from '../pr-comments/pr-comments.entity';
import { PRFile } from '../pr-files/pr-files.entity';
import { PRCommit } from '../pr-commits/pr-commits.entity';
import { PrLabel } from '../pr-labels/pr-labels.entity';

export enum PrState {
  OPEN = 'open',
  CLOSED = 'closed',
  MERGED = 'merged',
}

@Entity({ name: 'pr_metadata' })
@Unique(['repository', 'pr_number'])
@Index(['github_pr_id'])
@Index(['pr_number'])
@Index(['state'])
@Index(['merged_at'])
@Index(['github_created_at'])
export class PrMetadata {
  @PrimaryGeneratedColumn('uuid')
  pr_metadata_id: string;

  @Column({ type: 'bigint' })
  github_pr_id: number;

  @Column({ type: 'int' })
  pr_number: number;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({ type: 'enum', enum: PrState })
  state: PrState;

  @Column({ type: 'boolean', default: false })
  draft: boolean;

  @Column({ type: 'boolean', nullable: true })
  mergeable: boolean | null;

  @Column({ type: 'timestamp', nullable: true })
  merged_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'varchar', length: 255 })
  base_ref: string;

  @Column({ type: 'varchar', length: 40 })
  base_sha: string;

  @Column({ type: 'varchar', length: 255 })
  head_ref: string;

  @Column({ type: 'varchar', length: 40 })
  head_sha: string;

  @Column({ type: 'timestamp' })
  github_created_at: Date;

  @Column({ type: 'timestamp' })
  github_updated_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  // Relations
  @ManyToOne(() => Repository, (repository) => repository.prMetadata, {
    cascade: ['insert', 'update'],
    onDelete: 'RESTRICT'
  })
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @ManyToOne(() => GithubUser, (githubUser) => githubUser.authoredPrs, {
    cascade: ['insert', 'update'],
    onDelete: 'RESTRICT'
  })
  @JoinColumn({ name: 'author_github_user_id' })
  author: GithubUser;

  @OneToMany(() => PRReview, (prReview) => prReview.prMetadata)
  prReviews: PRReview[];

  @OneToMany(() => GithubPrReview, (githubPrReview) => githubPrReview.prMetadata)
  githubPrReviews: GithubPrReview[];

  @OneToMany(() => PrComment, (prComment) => prComment.prMetadata)
  prComments: PrComment[];

  @OneToMany(() => PRFile, (prFile) => prFile.prMetadata)
  prFiles: PRFile[];

  @OneToMany(() => PRCommit, (prCommit) => prCommit.prMetadata)
  prCommits: PRCommit[];

  @ManyToMany(() => PrLabel, (prLabel) => prLabel.prMetadata)
  @JoinTable({
    name: 'pr_metadata_labels',
    joinColumn: { name: 'pr_metadata_id', referencedColumnName: 'pr_metadata_id' },
    inverseJoinColumn: { name: 'pr_label_id', referencedColumnName: 'pr_label_id' }
  })
  labels: PrLabel[];

  @ManyToMany(() => GithubUser)
  @JoinTable({
    name: 'pr_assignees',
    joinColumn: { name: 'pr_metadata_id', referencedColumnName: 'pr_metadata_id' },
    inverseJoinColumn: { name: 'github_user_id', referencedColumnName: 'github_user_id' }
  })
  assignees: GithubUser[];
}