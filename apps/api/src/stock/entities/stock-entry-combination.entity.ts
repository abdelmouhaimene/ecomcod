import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import type { ProductSku } from '../../products/entities/product-sku.entity.js';
import type { StockEntryItem } from './stock-entry-item.entity.js';

/** Quantity assigned to one generated combination on a product stock line. */
@Entity('stock_entry_combinations')
@Index('IDX_stock_entry_combinations_entry_item', ['entryItemId'])
@Index('IDX_stock_entry_combinations_sku', ['skuId'])
@Index('UQ_stock_entry_combinations_item_sku', ['entryItemId', 'skuId'], { unique: true })
@Check('CHK_stock_entry_combinations_quantity', '"quantity" >= 0')
export class StockEntryCombination {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    entryItemId: string;

    @Column({ type: 'uuid' })
    skuId: string;

    /** Zero is allowed so all generated combinations can stay visible. */
    @Column({ type: 'int' })
    quantity: number;

    @ManyToOne('StockEntryItem', 'combinations', { onDelete: 'CASCADE' })
    entryItem: StockEntryItem;

    @ManyToOne('ProductSku', { onDelete: 'RESTRICT' })
    sku: ProductSku;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
