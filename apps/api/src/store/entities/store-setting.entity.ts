import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Singleton row holding the storefront's store identity and contact details. */
@Entity('store_settings')
export class StoreSetting {
    /** Fixed id: there is exactly one global store configuration. */
    @PrimaryColumn({ type: 'integer' })
    id: number;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'text' })
    description: string;

    /** Absolute URL or API-relative upload path. */
    @Column({ type: 'varchar', length: 500, default: '' })
    logo: string;

    @Column({ type: 'varchar', length: 200 })
    email: string;

    @Column({ type: 'varchar', length: 300, default: '' })
    website: string;

    @Column({ type: 'varchar', length: 300, default: '' })
    address: string;

    /** Raw dashboard input: a Maps link, `lat,lng`, or a place name. */
    @Column({ type: 'varchar', length: 500, default: '' })
    mapQuery: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
