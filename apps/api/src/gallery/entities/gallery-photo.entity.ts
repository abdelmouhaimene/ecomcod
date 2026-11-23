import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

/** One card in the home-page gallery carousel. */
@Entity('gallery_photos')
@Index('IDX_gallery_photos_date', ['date', 'createdAt'])
export class GalleryPhoto {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 500 })
    image: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    /** Stored as a calendar date (no time zone) and rendered by clients. */
    @Column({ type: 'date' })
    date: string;

    @Column({ type: 'varchar', length: 100 })
    location: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
