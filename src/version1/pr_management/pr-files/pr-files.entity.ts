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

export enum FileChangeType {
  ADDED = 'added',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  RENAMED = 'renamed',
}

@Entity('pr_files')
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
  file_language: string; // Programming language detected

  @Column({ type: 'int', nullable: true })
  file_size_bytes: number;

  @CreateDateColumn()
  created_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => PRReview, (prReview) => prReview.prFiles)
  @JoinColumn({ name: 'pr_review_id' })
  prReview: PRReview;
}
