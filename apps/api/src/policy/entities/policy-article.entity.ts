import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

/** One title/body article shown on the storefront policy page. */
@Entity('policy_articles')
@Index('IDX_policy_articles_active_position', ['isActive', 'position'])
@Check('CHK_policy_articles_position', '"position" >= 0')
export class PolicyArticle {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    title: string;

    @Column({ type: 'text' })
    body: string;

    @Column({ type: 'integer', default: 0 })
    position: number;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
