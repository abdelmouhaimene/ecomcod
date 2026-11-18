import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers.js';
import type { ProductImage } from './product-image.entity.js';
import type { Product } from './product.entity.js';

@Entity('product_variants')
@Index('IDX_product_variants_product', ['productId'])
@Index('IDX_product_variants_image', ['imageId'])
@Check('CHK_product_variants_price', '"price" >= 0')
export class ProductVariant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    productId: string;

    /** E.g. `Color`, `Size`, `Material`. */
    @Column({ type: 'varchar', length: 100 })
    name: string;

    /** E.g. `Red`, `M`, `Cotton`. */
    @Column({ type: 'varchar', length: 100 })
    value: string;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: numericTransformer,
    })
    price: number;

    /** Image chosen from the parent product's images. */
    @Column({ type: 'uuid' })
    imageId: string;

    /** String targets avoid an ESM cycle between catalog entities. */
    @ManyToOne('Product', 'variants', { onDelete: 'CASCADE' })
    product: Product;

    @ManyToOne('ProductImage', 'variants', { onDelete: 'CASCADE' })
    image: ProductImage;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
