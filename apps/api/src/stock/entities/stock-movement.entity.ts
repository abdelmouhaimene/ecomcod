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
import type { Order } from '../../orders/entities/order.entity.js';
import type { ProductSku } from '../../products/entities/product-sku.entity.js';
import type { Product } from '../../products/entities/product.entity.js';
import type { StockEntry } from './stock-entry.entity.js';

export const STOCK_MOVEMENT_SOURCES = ['ENTRY', 'SALE'] as const;
export type StockMovementSource = (typeof STOCK_MOVEMENT_SOURCES)[number];

@Entity('stock_movements')
@Index('IDX_stock_movements_sku', ['skuId'])
@Index('IDX_stock_movements_product', ['productId'])
@Index('IDX_stock_movements_entry', ['stockEntryId'])
@Index('IDX_stock_movements_order', ['orderId'])
@Check(
    'CHK_stock_movements_quantity',
    `("sourceType" = 'ENTRY' AND "quantity" > 0) OR ("sourceType" = 'SALE' AND "quantity" < 0)`,
)
export class StockMovement {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    skuId: string;

    @Column({ type: 'uuid' })
    productId: string;

    @Column({ type: 'varchar', length: 20 })
    sourceType: StockMovementSource;

    @Column({ type: 'uuid', nullable: true })
    stockEntryId: string | null;

    @Column({ type: 'uuid', nullable: true })
    orderId: string | null;

    /** Positive for entries, negative for sales. */
    @Column({ type: 'int' })
    quantity: number;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: numericTransformer,
    })
    unitPrice: number;

    @ManyToOne('ProductSku', { onDelete: 'CASCADE' })
    sku: ProductSku;

    @ManyToOne('Product', { onDelete: 'RESTRICT' })
    product: Product;

    @ManyToOne('StockEntry', { onDelete: 'CASCADE' })
    stockEntry: StockEntry;

    @ManyToOne('Order', { onDelete: 'CASCADE' })
    order: Order;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
