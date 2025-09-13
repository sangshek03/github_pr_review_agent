import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { AuthProvider } from '../../(auth_management)/auth-providers/auth-providers.entity';

// users.entity.ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true }) // Now nullable
  f_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true }) // Now nullable
  l_name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'boolean', default: false }) // NEW FIELD - Crucial for OAuth
  email_verified: boolean;

  @Column({ type: 'text', nullable: true }) // NEW FIELD
  avatar_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string; // Will be null for OAuth-only users

  @Column({ type: 'text', nullable: true })
  refresh_token: string; // For your app's JWT refresh, if you use it

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @OneToMany(() => AuthProvider, (authProvider) => authProvider.user)
  auth_providers: AuthProvider[];
}
