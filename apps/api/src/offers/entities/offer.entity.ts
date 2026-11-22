import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers.js';
import type { OfferPackItem } from './offer-pack-item.entity.js';
import type { OfferSingleRule } from './offer-single-rule.entity.js';

export const OFFER_TYPES = ['SINGLE_PRODUCT', 'PACK'] as const;
export type OfferTypeEntity = (typeof OFFER_TYPES)[number];

@Entity('offers')
@Index('UQ_offers_name', ['name'], { unique: true })
@Index('IDX_offers_active', ['isActive'])
@Check(
    'CHK_offers_price_shape',
    `("type" = 'PACK' AND "packPrice" IS NOT NULL) OR ("type" = 'SINGLE_PRODUCT' AND "packPrice" IS NULL)`,
)
export class Offer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'varchar', length: 30 })
    type: OfferTypeEntity;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    startsAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    endsAt: Date | null;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
        transformer: numericTransformer,
    })
    packPrice: number | null;

    @OneToOne('OfferSingleRule', 'offer', { cascade: true })
    singleRule: OfferSingleRule;

    @OneToMany('OfferPackItem', 'offer', { cascade: true })
    packItems: OfferPackItem[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
