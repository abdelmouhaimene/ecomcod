import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdminRole } from '@repo/types';

@Entity('admins')
/**
 * Database-level guarantee that only one admin can ever hold the system role,
 * even if two processes seed at the same time.
 */
@Index('UQ_admins_single_system', ['role'], {
  unique: true,
  where: `"role" = 'system'`,
})
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  /** Never returned by toPublic(); verified with hashPassword/verifyPassword. */
  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'enum', enum: AdminRole, default: AdminRole.AGENT })
  role: AdminRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
