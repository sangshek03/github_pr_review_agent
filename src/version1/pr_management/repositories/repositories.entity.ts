import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PRReview } from '../pr-reviews/pr-reviews.entity';

@Entity('repositories')
export class Repository {
  @PrimaryGeneratedColumn('uuid')
  repository_id: string;

  @Column({ type: 'varchar', length: 255 })
  repository_name: string;

  @Column({ type: 'varchar', length: 255 })
  repository_owner: string;

  @Column({ type: 'varchar', length: 500, unique: true })
  repository_url: string;

  @Column({ type: 'jsonb', nullable: true })
  languages: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Store non-queryable repo metadata

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int' })
  stars: number;

  @Column({ type: 'int' })
  forks: number;

  @Column({ type: 'int' })
  watchers: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @OneToMany(() => PRReview, (prReview) => prReview.repository)
  prReviews: PRReview[];
}
