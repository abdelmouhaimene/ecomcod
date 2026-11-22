import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers.js';
import type { ProductImage } from './product-image.entity.js';
import type { ProductVariantValue } from './product-variant-value.entity.js';
import type { Product } from './product.entity.js';

@Entity('product_skus')
@Index('IDX_product_skus_product', ['productId'])
@Index('UQ_product_skus_product_combination', ['productId', 'combinationKey'], { unique: true })
@Index('UQ_product_skus_code', ['sku'], { unique: true })
@Check('CHK_product_skus_stock', '"stockQuantity" >= 0 AND "PMP" >= 0')
export class ProductSku {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    productId: string;

    /** Human-friendly unique code derived from the product ref and combination. */
    @Column({ type: 'varchar', length: 150 })
    sku: string;

    /** Canonical sorted dimension signature, e.g. `COLOR:Red|SIZE_TEXT:M`. */
    @Column({ type: 'varchar', length: 500 })
    combinationKey: string;

    @Column({ type: 'varchar', length: 300 })
    label: string;

    @Column({ type: 'uuid', nullable: true })
    imageId: string | null;

    @Column({ type: 'int', default: 0 })
    stockQuantity: number;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: numericTransformer,
    })
    PMP: number;

    /** Removed combinations stay in history but cannot be sold or stocked. */
    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @ManyToOne('Product', 'skus', { onDelete: 'CASCADE' })
    product: Product;

    @ManyToOne('ProductImage', { onDelete: 'SET NULL' })
    image: ProductImage;

    @ManyToMany('ProductVariantValue')
    @JoinTable({
        name: 'product_sku_variant_values',
        joinColumn: { name: 'skuId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'variantValueId', referencedColumnName: 'id' },
    })
    variantValues: ProductVariantValue[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
