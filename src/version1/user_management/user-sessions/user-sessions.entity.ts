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
import { User } from '../users/users.entity';

export enum SessionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  user_session_id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  session_token: string; // JWT or session identifier

  @Column({ type: 'timestamp' })
  expires_at: Date; // When the session expires

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.ACTIVE })
  status: SessionStatus;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string; // Client IP address

  @Column({ type: 'text', nullable: true })
  user_agent: string; // Browser/device information

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_fingerprint: string; // Device identification

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string; // Geographic location (city, country)

  @Column({ type: 'timestamp', nullable: true })
  last_activity_at: Date; // Last time this session was used

  @Column({ type: 'jsonb', nullable: true })
  session_data: Record<string, any>; // Additional session metadata

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
