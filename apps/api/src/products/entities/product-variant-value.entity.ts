import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import type { ProductImage } from './product-image.entity.js';
import type { ProductVariant } from './product-variant.entity.js';

/** One allowed value of a product variant, e.g. Black under Color. */
@Entity('product_variant_values')
@Index('IDX_product_variant_values_variant', ['variantId'])
@Index('IDX_product_variant_values_image', ['imageId'])
@Index('UQ_product_variant_values_definition_value', ['variantId', 'value'], { unique: true })
@Check(
    'CHK_product_variant_values_hex',
    `"hexColor" IS NULL OR "hexColor" ~ '^#[0-9A-Fa-f]{6}$'`,
)
export class ProductVariantValue {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    variantId: string;

    /** E.g. `Black`, `M`, `Cotton`, or a custom value. */
    @Column({ type: 'varchar', length: 100 })
    value: string;

    /** Only used by `COLOR`; both swatch and label are shown in the UI. */
    @Column({ type: 'varchar', length: 7, nullable: true })
    hexColor: string | null;

    /** Optional image chosen from the parent product's images. */
    @Column({ type: 'uuid', nullable: true })
    imageId: string | null;

    @Column({ type: 'int', default: 0 })
    position: number;

    @ManyToOne('ProductVariant', 'values', { onDelete: 'CASCADE' })
    variant: ProductVariant;

    @ManyToOne('ProductImage', { onDelete: 'CASCADE' })
    image: ProductImage | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
