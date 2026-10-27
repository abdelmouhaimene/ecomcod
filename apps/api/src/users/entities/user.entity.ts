import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    fullName: string;

    @Column({ type: 'varchar', length: 10 })
    phoneNumber: string;

    @Column({ type: 'varchar', length: 100 })
    email: string;

    @Column({ type: 'varchar', length: 255, select: false })
    password: string;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    lastLoginAt?: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}