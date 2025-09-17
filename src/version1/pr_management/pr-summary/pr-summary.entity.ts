import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user_management/users/users.entity';
import { PRReview } from '../pr-reviews/pr-reviews.entity';

@Entity({ schema: 'githubagent', name: 'pr_summary' })
export class PrSummary {
  @PrimaryGeneratedColumn('uuid')
  pr_summary_id: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb' })
  issues_found: string[];

  @Column({ type: 'jsonb' })
  suggestions: string[];

  @Column({ type: 'jsonb' })
  test_recommendations: string[];

  @Column({ type: 'int', default: 0 })
  overall_score: number;

  @Column({ type: 'jsonb' })
  security_concerns: string[];

  @Column({ type: 'jsonb' })
  performance_issues: string[];

  @Column({ type: 'jsonb' })
  well_handled_cases: { area: string; reason: string }[];

  @Column({ type: 'jsonb' })
  future_enhancements: string[];

  @Column({ type: 'jsonb' })
  code_quality_rating: {
    readability: number;
    maintainability: number;
    scalability: number;
    testing: number;
  };

  @Column({ type: 'varchar', length: 50, nullable: true })
  analysis_model: string;

  @Column({ type: 'timestamp', nullable: true })
  analysis_timestamp: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => PRReview, (prReview) => prReview.prSummaries, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pr_review_id' })
  prReview: PRReview;
}