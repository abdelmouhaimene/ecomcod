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
import type { ProductVariantValue } from './product-variant-value.entity.js';
import type { Product } from './product.entity.js';

export const VARIANT_TYPES = ['COLOR', 'SIZE_TEXT', 'SIZE_NUM', 'DESIGN', 'OTHER'] as const;
export type VariantTypeEntity = (typeof VARIANT_TYPES)[number];

export const SIZE_TEXT_VALUES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

/** A product-scoped dimension, e.g. Color or Size. Values live in their own table. */
@Entity('product_variants')
@Index('IDX_product_variants_product', ['productId'])
@Check('CHK_product_variants_variant_type', `"variantType" IN ('COLOR', 'SIZE_TEXT', 'SIZE_NUM', 'DESIGN', 'OTHER')`)
export class ProductVariant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    productId: string;

    /** Dimension label. For `OTHER`, this is the user-created type name. */
    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 30, default: 'OTHER' })
    variantType: VariantTypeEntity;

    @ManyToOne('Product', 'variants', { onDelete: 'CASCADE' })
    product: Product;

    @OneToMany('ProductVariantValue', 'variant', { cascade: true })
    values: ProductVariantValue[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
