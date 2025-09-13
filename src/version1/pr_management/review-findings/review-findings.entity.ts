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

export enum ReviewFindingCategory {
  POSITIVE = 'positive',
  ISSUE = 'issue',
  SUGGESTION = 'suggestion',
  FUTURE_BUG = 'future_bug',
}

export enum ReviewFindingSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Entity('review_findings')
export class ReviewFinding {
  @PrimaryGeneratedColumn('uuid')
  review_finding_id: string;

  @Column({ type: 'enum', enum: ReviewFindingCategory })
  category: ReviewFindingCategory;

  @Column({ type: 'varchar', length: 500, nullable: true })
  file_path: string;

  @Column({ type: 'int', nullable: true })
  line_number: number;

  @Column({ type: 'enum', enum: ReviewFindingSeverity, nullable: true })
  severity: ReviewFindingSeverity;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => PRReview, (prReview) => prReview.reviewFindings)
  @JoinColumn({ name: 'pr_review_id' })
  prReview: PRReview;
}
