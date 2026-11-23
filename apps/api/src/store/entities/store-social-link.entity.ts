import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { SocialPlatform } from '@repo/types';
import { StoreSetting } from './store-setting.entity.js';

/** One enabled social network with the URL entered in the dashboard. */
@Entity('store_social_links')
@Index('IDX_store_social_links_setting', ['setting'])
export class StoreSocialLink {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => StoreSetting, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'settingId' })
    setting: StoreSetting;

    @Column({ type: 'varchar', length: 20 })
    platform: SocialPlatform;

    @Column({ type: 'varchar', length: 500 })
    url: string;
}
