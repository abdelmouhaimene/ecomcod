import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { Product } from '../../products/entities/product.entity.js';

@Entity('families')
@Index('UQ_families_name', ['name'], { unique: true })
@Index('UQ_families_ref', ['ref'], { unique: true })
export class Family {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 50 })
    ref: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    /** String target avoids an ESM cycle between catalog entities. */
    @ManyToMany('Product', 'families')
    @JoinTable({
        name: 'product_families',
        joinColumn: { name: 'familyId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'productId', referencedColumnName: 'id' },
    })
    products: Product[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
