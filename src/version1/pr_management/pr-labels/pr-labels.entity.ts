import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { Repository } from '../repositories/repositories.entity';

@Entity({ name: 'pr_labels' })
@Unique(['repository', 'name'])
@Index(['name'])
@Index(['color'])
export class PrLabel {
  @PrimaryGeneratedColumn('uuid')
  pr_label_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 6 })
  color: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  // Relations
  @ManyToOne(() => Repository, {
    cascade: ['insert', 'update'],
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @ManyToMany(() => PrMetadata, (prMetadata) => prMetadata.labels)
  prMetadata: PrMetadata[];
}