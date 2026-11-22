import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers.js';
import type { Product } from '../../products/entities/product.entity.js';
import type { StockEntryCombination } from './stock-entry-combination.entity.js';
import type { StockEntry } from './stock-entry.entity.js';

/** One product line on a stock entry; its combinations share the buying price. */
@Entity('stock_entry_items')
@Index('IDX_stock_entry_items_entry', ['entryId'])
@Index('IDX_stock_entry_items_product', ['productId'])
@Check('CHK_stock_entry_items_buying_price', '"buyingPrice" >= 0')
@Check('CHK_stock_entry_items_total_quantity', '"totalQuantity" > 0')
export class StockEntryItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    entryId: string;

    @Column({ type: 'uuid' })
    productId: string;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: numericTransformer,
    })
    buyingPrice: number;

    /** Must equal the sum of this item's combination quantities. */
    @Column({ type: 'int' })
    totalQuantity: number;

    /** `totalQuantity * buyingPrice`, computed by the API. */
    @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
    lineTotal: number;

    @ManyToOne('StockEntry', 'items', { onDelete: 'CASCADE' })
    entry: StockEntry;

    @ManyToOne('Product', { onDelete: 'RESTRICT' })
    product: Product;

    @OneToMany('StockEntryCombination', 'entryItem', { cascade: true })
    combinations: StockEntryCombination[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
