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

@Entity('offer_pack_items')
@Index('IDX_offer_pack_items_offer', ['offerId'])
@Index('UQ_offer_pack_items_offer_product', ['offerId', 'productId'], { unique: true })
@Check('CHK_offer_pack_items_quantity', '"quantity" > 0')
export class OfferPackItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    offerId: string;

    @Column({ type: 'uuid' })
    productId: string;

    @Column({ type: 'int' })
    quantity: number;

    @ManyToOne('Offer', 'packItems', { onDelete: 'CASCADE' })
    offer: Offer;

    @ManyToOne('Product', { onDelete: 'RESTRICT' })
    product: Product;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
