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

export enum FileChangeType {
  ADDED = 'added',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  RENAMED = 'renamed',
  REMOVED = 'removed',
  CHANGED = 'changed',
  COPIED = 'copied',
}

@Entity({ schema: 'githubagent', name: 'pr_files' })
export class PRFile {
  @PrimaryGeneratedColumn('uuid')
  pr_file_id: string;

  @Column({ type: 'varchar', length: 500 })
  file_path: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  previous_file_path: string; // For renamed files

  @Column({ type: 'enum', enum: FileChangeType })
  change_type: FileChangeType;

  @Column({ type: 'int', default: 0 })
  additions: number;

  @Column({ type: 'int', default: 0 })
  deletions: number;

  @Column({ type: 'text', nullable: true })
  patch: string; // Git diff content

  @Column({ type: 'varchar', length: 100, nullable: true })
  file_language: string | null; // Programming language detected

  @Column({ type: 'int', nullable: true })
  file_size_bytes: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  blob_sha: string | null;

  @Column({ type: 'text', nullable: true })
  raw_url: string;

  @Column({ type: 'text', nullable: true })
  contents_url: string;

  @Column({ type: 'int', nullable: true })
  patch_size_bytes: number;

  @Column({ type: 'boolean', default: false })
  is_binary: boolean;

  @Column({ type: 'jsonb', nullable: true })
  analysis_notes: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => PRReview, (prReview) => prReview.prFiles)
  @JoinColumn({ name: 'pr_review_id' })
  prReview: PRReview;

  @ManyToOne(() => PrMetadata, (prMetadata) => prMetadata.prFiles, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pr_metadata_id' })
  prMetadata: PrMetadata;
}
