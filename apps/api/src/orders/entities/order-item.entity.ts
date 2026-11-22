import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers.js';
import type { ProductSku } from '../../products/entities/product-sku.entity.js';
import type { Product } from '../../products/entities/product.entity.js';
import type { Order } from './order.entity.js';

export const ORDER_ITEM_KINDS = ['REGULAR', 'SINGLE_FREE', 'PACK'] as const;
export type OrderItemKindEntity = (typeof ORDER_ITEM_KINDS)[number];

@Entity('order_items')
@Index('IDX_order_items_order', ['orderId'])
@Index('IDX_order_items_sku', ['skuId'])
@Index('IDX_order_items_offer', ['offerId'])
@Check('CHK_order_items_quantity', '"quantity" > 0')
@Check('CHK_order_items_unit_price', '"unitPrice" >= 0')
export class OrderItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    orderId: string;

    @Column({ type: 'uuid' })
    skuId: string;

    @Column({ type: 'uuid' })
    productId: string;

    /** Denormalised snapshots survive offer/product deletion. */
    @Column({ type: 'varchar', length: 150 })
    sku: string;

    @Column({ type: 'varchar', length: 150 })
    productName: string;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
    unitPrice: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
    lineTotal: number;

    @Column({ type: 'varchar', length: 30 })
    kind: OrderItemKindEntity;

    @Column({ type: 'uuid', nullable: true })
    offerId: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    offerName: string | null;

    @ManyToOne('Order', 'items', { onDelete: 'CASCADE' })
    order: Order;

    @ManyToOne('ProductSku', { onDelete: 'RESTRICT' })
    skuRelation: ProductSku;

    @ManyToOne('Product', { onDelete: 'RESTRICT' })
    product: Product;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
