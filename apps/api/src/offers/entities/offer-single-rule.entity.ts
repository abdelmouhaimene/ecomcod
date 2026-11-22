import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import type { Product } from '../../products/entities/product.entity.js';
import type { Offer } from './offer.entity.js';

export const SINGLE_OFFER_MODES = ['BUY_X_GET_Y_FREE', 'BUY_X_GET_FREE_SHIPPING'] as const;
export type SingleOfferModeEntity = (typeof SINGLE_OFFER_MODES)[number];

@Entity('offer_single_rules')
@Index('UQ_offer_single_rules_offer', ['offerId'], { unique: true })
@Check('CHK_offer_single_rules_buy', '"buyQuantity" > 0')
@Check(
    'CHK_offer_single_rules_free',
    `("mode" = 'BUY_X_GET_Y_FREE' AND "freeQuantity" > 0)
      OR ("mode" = 'BUY_X_GET_FREE_SHIPPING' AND "freeQuantity" IS NULL)`,
)
export class OfferSingleRule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    offerId: string;

    @Column({ type: 'uuid' })
    productId: string;

    @Column({ type: 'varchar', length: 40 })
    mode: SingleOfferModeEntity;

    @Column({ type: 'int' })
    buyQuantity: number;

    @Column({ type: 'int', nullable: true })
    freeQuantity: number | null;

    @ManyToOne('Offer', 'singleRule', { onDelete: 'CASCADE' })
    offer: Offer;

    @ManyToOne('Product', { onDelete: 'RESTRICT' })
    product: Product;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
