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
import type { ProductVariant } from './product-variant.entity.js';
import type { Product } from './product.entity.js';

@Entity('product_images')
@Index('IDX_product_images_product', ['productId'])
@Index('UQ_product_images_product_url', ['productId', 'url'], { unique: true })
/** Exactly one image per product can be the main image. */
@Index('UQ_product_images_main', ['productId'], {
    unique: true,
    where: '"isMain" = true',
})
@Check('CHK_product_images_position', '"position" >= 0')
export class ProductImage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    productId: string;

    /** Relative URL served by the API upload controller. */
    @Column({ type: 'varchar', length: 500 })
    url: string;

    @Column({ type: 'int', default: 0 })
    position: number;

    @Column({ type: 'boolean', default: false })
    isMain: boolean;

    /** String targets avoid an ESM cycle between catalog entities. */
    @ManyToOne('Product', 'images', { onDelete: 'CASCADE' })
    product: Product;

    @OneToMany('ProductVariant', 'image')
    variants: ProductVariant[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
