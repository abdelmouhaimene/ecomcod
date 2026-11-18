import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Category } from '../../categories/entities/category.entity.js';
import type { Product } from './product.entity.js';

/** Explicit join entity so both foreign keys are indexed. */
@Entity('product_categories')
@Index('IDX_product_categories_category', ['categoryId'])
export class ProductCategory {
    @PrimaryColumn({ type: 'uuid' })
    productId: string;

    @PrimaryColumn({ type: 'uuid' })
    categoryId: string;

    /** String targets avoid an ESM cycle between catalog entities. */
    @ManyToOne('Product', 'productCategories', { onDelete: 'CASCADE' })
    product: Product;

    @ManyToOne('Category', 'productCategories', { onDelete: 'CASCADE' })
    category: Category;
}
