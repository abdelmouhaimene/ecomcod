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
import type { ProductCategory } from './product-category.entity.js';
import type { ProductImage } from './product-image.entity.js';
import type { ProductVariant } from './product-variant.entity.js';

@Entity('products')
@Index('UQ_products_ref', ['ref'], { unique: true })
@Check('CHK_products_price', '"price" >= 0')
@Check('CHK_products_old_price', '"oldPrice" IS NULL OR "oldPrice" >= 0')
@Check(
    'CHK_products_reviews',
    '"fakeReviews" >= 0 AND "fakeReviews" <= 5 AND "realReviews" >= 0 AND "realReviews" <= 5',
)
@Check('CHK_products_counters', '"fakeSolds" >= 0 AND "realSolds" >= 0')
@Check('CHK_products_stock', '"quantity" >= 0 AND "PMP" >= 0')
export class Product {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 50 })
    ref: string;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'varchar', length: 200, nullable: true })
    subtitle: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: numericTransformer,
    })
    price: number;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
        transformer: numericTransformer,
    })
    oldPrice: number | null;

    @Column({
        type: 'numeric',
        precision: 2,
        scale: 1,
        default: 0,
        transformer: numericTransformer,
    })
    fakeReviews: number;

    @Column({
        type: 'numeric',
        precision: 2,
        scale: 1,
        default: 0,
        transformer: numericTransformer,
    })
    realReviews: number;

    @Column({ type: 'int', default: 0 })
    fakeSolds: number;

    @Column({ type: 'int', default: 0 })
    realSolds: number;

    /** Stock on hand; only updated by stock entries. */
    @Column({ type: 'int', default: 0 })
    quantity: number;

    /** Weighted average purchase price (PMP/WAP); only updated by stock entries. */
    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: numericTransformer,
    })
    PMP: number;

    /** String targets avoid an ESM cycle between catalog entities. */
    @OneToMany('ProductCategory', 'product')
    productCategories: ProductCategory[];

    @OneToMany('ProductImage', 'product')
    images: ProductImage[];

    @OneToMany('ProductVariant', 'product')
    variants: ProductVariant[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
