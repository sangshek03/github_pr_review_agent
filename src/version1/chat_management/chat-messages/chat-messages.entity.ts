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
import { PRReview } from '../../pr_management/pr-reviews/pr-reviews.entity';

export enum ChatMessageSender {
  USER = 'user',
  AI = 'ai',
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  chat_id: string;

  @Column({ type: 'enum', enum: ChatMessageSender })
  sender: ChatMessageSender;

  @Column({ type: 'jsonb' })
  content: any; // text, markdown, or structured JSON for code blocks

  @CreateDateColumn()
  created_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => PRReview, (prReview) => prReview.chatMessages)
  @JoinColumn({ name: 'pr_review_id' })
  prReview: PRReview;
}
