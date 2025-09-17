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
import { PrMetadata } from '../../pr_management/pr-metadata/pr-metadata.entity';
import { Repository } from '../../pr_management/repositories/repositories.entity';
import { ChatMessage } from '../chat-messages/chat-messages.entity';

export enum SessionType {
  PR_SPECIFIC = 'PR_SPECIFIC',
  REPOSITORY_WIDE = 'REPOSITORY_WIDE',
}

@Entity({ schema: 'githubagent', name: 'chat_sessions' })
@Index(['user'])
@Index(['prMetadata'])
@Index(['repository'])
@Index(['session_type'])
@Index(['last_activity'])
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  session_id: string;

  @Column({ type: 'varchar', length: 255 })
  session_name: string;

  @Column({ type: 'enum', enum: SessionType })
  session_type: SessionType;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_activity: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => PrMetadata, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'pr_metadata_id' })
  prMetadata?: PrMetadata;

  @ManyToOne(() => Repository, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'repository_id' })
  repository?: Repository;

  @OneToMany(() => ChatMessage, (chatMessage) => chatMessage.chatSession)
  messages: ChatMessage[];
}