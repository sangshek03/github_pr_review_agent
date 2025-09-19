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
import { ChatSession } from '../chat-sessions/chat-sessions.entity';

export enum MessageType {
  TEXT = 'text',
  CODE = 'code',
  JSON = 'json',
  MARKDOWN = 'markdown',
}

export enum SenderType {
  USER = 'user',
  BOT = 'bot',
}

@Entity({ name: 'chat_messages' })
@Index(['chatSession'])
@Index(['sender_type'])
@Index(['created_at'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  message_id: string;

  @Column({ type: 'enum', enum: SenderType })
  sender_type: SenderType;

  @Column({ type: 'enum', enum: MessageType })
  message_type: MessageType;

  @Column({ type: 'text' })
  message_content: string;

  @Column({ type: 'jsonb', nullable: true })
  context_used: string[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  query_classification: string;

  @Column({ type: 'jsonb', nullable: true })
  response_metadata: {
    followup_questions?: string[];
    context_sources?: string[];
    confidence_score?: number;
  };

  @CreateDateColumn()
  created_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => ChatSession, (chatSession) => chatSession.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  chatSession: ChatSession;
}
