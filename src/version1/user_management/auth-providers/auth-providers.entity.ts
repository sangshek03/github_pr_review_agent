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

export enum AuthProviderType {
  GOOGLE = 'google',
  GITHUB = 'github',
}

@Entity('auth_providers')
export class AuthProvider {
  @PrimaryGeneratedColumn('uuid')
  auth_provider_id: string;

  @Column({ type: 'enum', enum: AuthProviderType })
  provider: AuthProviderType;

  @Column({ type: 'varchar', length: 255 })
  provider_account_id: string;

  @Column({ type: 'text', nullable: true })
  access_token_encrypted: string;

  @Column({ type: 'text', nullable: true })
  refresh_token_encrypted: string;

  @Column({ type: 'text', nullable: true })
  scope: string;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => User, (user) => user.auth_providers)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
