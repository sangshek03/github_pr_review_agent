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
} from 'typeorm';
import { PRReview } from '../pr-reviews/pr-reviews.entity';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { GithubUser } from '../github-users/github-users.entity';

@Entity({ schema: 'githubagent', name: 'pr_commits' })
export class PRCommit {
  @PrimaryGeneratedColumn('uuid')
  pr_commit_id: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  commit_sha: string; // Git commit hash

  @Column({ type: 'text' })
  message: string; // Commit message

  @Column({ type: 'varchar', length: 255 })
  author: string; // Commit author

  @Column({ type: 'varchar', length: 255 })
  author_email: string; // Author email

  @Column({ type: 'timestamp' })
  committed_at: Date; // When the commit was made

  @Column({ type: 'varchar', length: 40, nullable: true })
  parent_sha: string; // Parent commit SHA

  @Column({ type: 'varchar', length: 500, nullable: true })
  commit_url: string; // GitHub URL for the commit

  @Column({ type: 'int', default: 0 })
  additions: number; // Lines added in this commit

  @Column({ type: 'int', default: 0 })
  deletions: number; // Lines deleted in this commit

  @Column({ type: 'varchar', length: 40, nullable: true })
  tree_sha: string;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verification_reason: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => PRReview, (prReview) => prReview.prCommits)
  @JoinColumn({ name: 'pr_review_id' })
  prReview: PRReview;

  @ManyToOne(() => PrMetadata, (prMetadata) => prMetadata.prCommits, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pr_metadata_id' })
  prMetadata: PrMetadata;

  @ManyToOne(() => GithubUser, (githubUser) => githubUser.authoredCommits, {
    cascade: ['insert', 'update'],
    onDelete: 'SET NULL',
    nullable: true
  })
  @JoinColumn({ name: 'github_author_id' })
  githubAuthor: GithubUser | null;
}
