import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { GithubUser } from '../github-users/github-users.entity';

@Entity({ schema: 'githubagent', name: 'pr_assignees' })
@Index(['pr_metadata_id'])
@Index(['github_user_id'])
export class PrAssignee {
  @PrimaryColumn('uuid')
  pr_metadata_id: string;

  @PrimaryColumn('uuid')
  github_user_id: string;

  @CreateDateColumn()
  assigned_at: Date;

  // Relations
  @ManyToOne(() => PrMetadata, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pr_metadata_id' })
  prMetadata: PrMetadata;

  @ManyToOne(() => GithubUser, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'github_user_id' })
  githubUser: GithubUser;
}