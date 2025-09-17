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
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';

@Entity({ schema: 'githubagent', name: 'repositories' })
export class Repository {
  @PrimaryGeneratedColumn('uuid')
  repository_id: string;

  @Column({ type: 'varchar', length: 255 })
  repository_name: string;

  @Column({ type: 'varchar', length: 255 })
  repository_owner: string;

  @Column({ type: 'varchar', length: 500, unique: true })
  repository_url: string;

  @Column({ type: 'bigint', unique: true })
  github_repo_id: number;

  @Column({ type: 'varchar', length: 255, default: 'main' })
  default_branch: string;

  @Column({ type: 'boolean', default: false })
  is_private: boolean;

  @Column({ type: 'boolean', default: false })
  is_fork: boolean;

  @Column({ type: 'boolean', default: false })
  is_archived: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_synced_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  topics: string[]; // Array of topics

  @Column({ type: 'text', nullable: true })
  homepage: string;

  @Column({ type: 'int', nullable: true })
  size: number; // Repo size in KB

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

  @OneToMany(() => PrMetadata, (prMetadata) => prMetadata.repository)
  prMetadata: PrMetadata[];
}
