import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { CommentSource } from '@repo/types';

/**
 * Global storefront testimonial. User comments keep an internal `userId`;
 * admin-authored ones carry the display name/image entered in the dashboard.
 */
@Entity('comments')
@Index('IDX_comments_createdAt', ['createdAt'])
export class Comment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    username: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    userImage: string | null;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'smallint' })
    rating: number;

    @Column({ type: 'varchar', length: 10, default: 'USER' })
    source: CommentSource;

    /** Null for admin-authored testimonials; not exposed on the public wire. */
    @Column({ type: 'uuid', nullable: true })
    userId: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
