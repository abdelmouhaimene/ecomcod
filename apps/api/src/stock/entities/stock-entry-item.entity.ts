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
import type { Product } from '../../products/entities/product.entity.js';
import type { StockEntry } from './stock-entry.entity.js';

@Entity('stock_entry_items')
@Index('IDX_stock_entry_items_entry', ['entryId'])
@Index('IDX_stock_entry_items_product', ['productId'])
@Check('CHK_stock_entry_items_quantity', '"quantity" > 0')
@Check('CHK_stock_entry_items_unit_price', '"unitPrice" >= 0')
export class StockEntryItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    entryId: string;

    @Column({ type: 'uuid' })
    productId: string;

    @Column({ type: 'int' })
    quantity: number;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: numericTransformer,
    })
    unitPrice: number;

    /** `quantity * unitPrice`, computed by the API. */
    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: numericTransformer,
    })
    lineTotal: number;

    /** String targets avoid an ESM cycle between stock entities. */
    @ManyToOne('StockEntry', 'items', { onDelete: 'CASCADE' })
    entry: StockEntry;

    @ManyToOne('Product', { onDelete: 'RESTRICT' })
    product: Product;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
