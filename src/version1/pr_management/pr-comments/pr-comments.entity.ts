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
  Unique,
} from 'typeorm';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { GithubUser } from '../github-users/github-users.entity';

export enum CommentSide {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

@Entity({ name: 'pr_comments' })
@Unique(['github_comment_id'])
@Index(['github_comment_id'])
@Index(['path'])
@Index(['line'])
@Index(['github_created_at'])
export class PrComment {
  @PrimaryGeneratedColumn('uuid')
  pr_comment_id: string;

  @Column({ type: 'bigint', unique: true })
  github_comment_id: number;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  path: string;

  @Column({ type: 'int', nullable: true })
  line: number;

  @Column({ type: 'enum', enum: CommentSide, nullable: true })
  side: CommentSide;

  @Column({ type: 'int', nullable: true })
  in_reply_to_id: number;

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
  @ManyToOne(() => PrMetadata, (prMetadata) => prMetadata.prComments, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pr_metadata_id' })
  prMetadata: PrMetadata;

  @ManyToOne(() => GithubUser, (githubUser) => githubUser.prComments, {
    cascade: ['insert', 'update'],
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'author_github_user_id' })
  author: GithubUser;
}
