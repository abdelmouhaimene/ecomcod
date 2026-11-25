import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

/** One question/answer pair shown in the storefront FAQ accordion. */
@Entity('faq_items')
@Index('IDX_faq_items_active_position', ['isActive', 'position'])
@Check('CHK_faq_items_position', '"position" >= 0')
export class FaqItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    question: string;

    @Column({ type: 'text' })
    answer: string;

    @Column({ type: 'integer', default: 0 })
    position: number;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
