import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StoreSetting } from './store-setting.entity.js';

/** A phone number shown in the storefront contact block. */
@Entity('store_phones')
@Index('IDX_store_phones_setting', ['setting'])
export class StorePhone {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => StoreSetting, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'settingId' })
    setting: StoreSetting;

    @Column({ type: 'varchar', length: 50 })
    number: string;

    @Column({ type: 'integer', default: 0 })
    position: number;
}
