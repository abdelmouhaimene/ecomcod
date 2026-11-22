import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { StockEntry } from './stock-entry.entity.js';

/** A managed supplier referenced by stock entry documents. */
@Entity('suppliers')
@Index('UQ_suppliers_name', ['name'], { unique: true })
export class Supplier {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'varchar', length: 300, nullable: true })
    address: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    phone: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    email: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    /** String targets avoid an ESM cycle between stock entities. */
    @OneToMany('StockEntry', 'supplier')
    entries: StockEntry[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
