import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { ProductCategory } from '../../products/entities/product-category.entity.js';

@Entity('categories')
@Index('UQ_categories_name', ['name'], { unique: true })
@Index('UQ_categories_ref', ['ref'], { unique: true })
export class Category {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    /** Short unique code, e.g. `audio`. */
    @Column({ type: 'varchar', length: 50 })
    ref: string;

    /** String targets avoid an ESM cycle between catalog entities. */
    @OneToMany('ProductCategory', 'category')
    productCategories: ProductCategory[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
