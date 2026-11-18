import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { Admin } from '../../admins/entities/admin.entity.js';
import { numericTransformer } from '../../common/transformers.js';
import type { StockEntryItem } from './stock-entry-item.entity.js';
import type { Supplier } from './supplier.entity.js';

/** A "bon d'entrée": one supplier delivery, with one or more product lines. */
@Entity('stock_entries')
@Index('IDX_stock_entries_date', ['date'])
@Index('IDX_stock_entries_supplier', ['supplierId'])
@Index('IDX_stock_entries_admin', ['adminId'])
export class StockEntry {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** Calendar date of the document as `YYYY-MM-DD`. */
    @Column({ type: 'date' })
    date: string;

    @Column({ type: 'uuid' })
    supplierId: string;

    /** Admin who created the document. */
    @Column({ type: 'uuid' })
    adminId: string;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: numericTransformer,
    })
    total: number;

    /** String targets avoid an ESM cycle between stock entities. */
    @ManyToOne('Supplier', 'entries', { onDelete: 'RESTRICT' })
    supplier: Supplier;

    @ManyToOne('Admin', { onDelete: 'RESTRICT' })
    admin: Admin;

    @OneToMany('StockEntryItem', 'entry')
    items: StockEntryItem[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
