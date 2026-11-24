import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers.js';
import type { OrderItem } from './order-item.entity.js';

export const ORDER_SOURCES = ['WEB', 'POS'] as const;
export type OrderSourceEntity = (typeof ORDER_SOURCES)[number];

export const ORDER_STATUSES = ['COMPLETED', 'CANCELLED'] as const;
export type OrderStatusEntity = (typeof ORDER_STATUSES)[number];

@Entity('orders')
@Index('UQ_orders_number', ['orderNumber'], { unique: true })
@Index('IDX_orders_created', ['createdAt'])
@Check('CHK_orders_totals', '"subtotal" >= 0 AND "discount" >= 0 AND "shippingCost" >= 0 AND "taxAmount" >= 0 AND "total" >= 0')
export class Order {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 40 })
    orderNumber: string;

    @Column({ type: 'varchar', length: 20 })
    source: OrderSourceEntity;

    @Column({ type: 'varchar', length: 20, default: 'COMPLETED' })
    status: OrderStatusEntity;

    @Column({ type: 'varchar', length: 150, nullable: true })
    customerName: string | null;

    @Column({ type: 'varchar', length: 200, nullable: true })
    customerEmail: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    customerPhone: string | null;

    @Column({ type: 'varchar', length: 2, nullable: true })
    wilayaCode: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    wilayaName: string | null;

    @Column({ type: 'varchar', length: 4, nullable: true })
    communeCode: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    communeName: string | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
    subtotal: number;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: numericTransformer,
    })
    discount: number;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: numericTransformer,
    })
    shippingCost: number;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: numericTransformer,
    })
    taxAmount: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
    total: number;

    @Column({ type: 'boolean', default: false })
    freeShipping: boolean;

    @OneToMany('OrderItem', 'order', { cascade: true })
    items: OrderItem[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
