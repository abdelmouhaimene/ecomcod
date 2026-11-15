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

    @Column({ type: 'varchar', length: 100, nullable: true })
    fullName: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true })
    phoneNumber: string | null;

    @Column({ type: 'varchar', length: 100, unique: true })
    email: string;

    /** Google "sub" claim; set the first time this account signs in with Google. */
    @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    googleId: string | null;

    @Column({ type: 'varchar', length: 255, select: false, nullable: true })
    password: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    emailVerifiedAt: Date | null;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    lastLoginAt?: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
