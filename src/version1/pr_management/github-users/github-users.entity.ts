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
  Unique,
} from 'typeorm';
import { User } from '../../user_management/users/users.entity';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { GithubPrReview } from '../github-pr-reviews/github-pr-reviews.entity';
import { PrComment } from '../pr-comments/pr-comments.entity';
import { PRCommit } from '../pr-commits/pr-commits.entity';

@Entity({  name: 'github_users' })
@Unique(['github_id'])
@Unique(['login'])
@Index(['github_id'])
@Index(['login'])
export class GithubUser {
  @PrimaryGeneratedColumn('uuid')
  github_user_id: string;

  @Column({ type: 'bigint', unique: true })
  github_id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  login: string;

  @Column({ type: 'text', nullable: true })
  avatar_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => PrMetadata, (prMetadata) => prMetadata.author)
  authoredPrs: PrMetadata[];

  @OneToMany(() => GithubPrReview, (githubPrReview) => githubPrReview.reviewer)
  githubPrReviews: GithubPrReview[];

  @OneToMany(() => PrComment, (prComment) => prComment.author)
  prComments: PrComment[];

  @OneToMany(() => PRCommit, (prCommit) => prCommit.githubAuthor)
  authoredCommits: PRCommit[];
}