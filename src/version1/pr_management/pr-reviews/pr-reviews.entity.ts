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
import { ReviewFinding } from '../review-findings/review-findings.entity';
import { ChatMessage } from '../../chat_management/chat-messages/chat-messages.entity';
import { PRFile } from '../pr-files/pr-files.entity';
import { PRCommit } from '../pr-commits/pr-commits.entity';

export enum PRReviewStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('pr_reviews')
export class PRReview {
  @PrimaryGeneratedColumn('uuid')
  pr_review_id: string;

  @Column({ type: 'varchar', unique: true })
  pr_url: string;

  @Column({ type: 'int' })
  pr_number: number;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 255 })
  author: string;

  @Column({ type: 'enum', enum: PRReviewStatus })
  status: PRReviewStatus;

  @Column({ type: 'varchar', length: 255 })
  base_branch: string;

  @Column({ type: 'varchar', length: 255 })
  head_branch: string;

  @Column({ type: 'int' })
  files_changed: number;

  @Column({ type: 'int' })
  additions: number;

  @Column({ type: 'int' })
  deletions: number;

  @Column({ type: 'text' })
  summary: string;

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

  @OneToMany(() => ReviewFinding, (reviewFinding) => reviewFinding.prReview)
  reviewFindings: ReviewFinding[];

  @OneToMany(() => ChatMessage, (chatMessage) => chatMessage.prReview)
  chatMessages: ChatMessage[];

  @OneToMany(() => PRFile, (prFile) => prFile.prReview)
  prFiles: PRFile[];

  @OneToMany(() => PRCommit, (prCommit) => prCommit.prReview)
  prCommits: PRCommit[];
}
