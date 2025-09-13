import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PRReview } from '../pr-reviews/pr-reviews.entity';

@Entity('pr_commits')
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

  @CreateDateColumn()
  created_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => PRReview, (prReview) => prReview.prCommits)
  @JoinColumn({ name: 'pr_review_id' })
  prReview: PRReview;
}