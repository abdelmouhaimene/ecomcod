import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Singleton row that controls whether the gallery appears on the home page. */
@Entity('gallery_settings')
export class GallerySetting {
    /** Fixed id: there is exactly one global gallery configuration. */
    @PrimaryColumn({ type: 'integer' })
    id: number;

    @Column({ type: 'boolean', default: false })
    isActive: boolean;
}
