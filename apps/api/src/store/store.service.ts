import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PublicStoreInfo } from '@repo/types';
import { DataSource, Repository } from 'typeorm';
import { StoreInfoDto } from './dto/store.dto.js';
import { StorePhone } from './entities/store-phone.entity.js';
import { StoreSetting } from './entities/store-setting.entity.js';
import { StoreSocialLink } from './entities/store-social-link.entity.js';
import { toMapEmbedUrl, toMapLink } from './store-map.util.js';

export type StoreInfoWithDates = PublicStoreInfo<Date>;

const SETTINGS_ID = 1;

/** Singleton storefront configuration shared by the dashboard and web app. */
@Injectable()
export class StoreService {
    constructor(
        @InjectRepository(StoreSetting) private readonly settings: Repository<StoreSetting>,
        @InjectRepository(StorePhone) private readonly phones: Repository<StorePhone>,
        @InjectRepository(StoreSocialLink) private readonly socialLinks: Repository<StoreSocialLink>,
        private readonly dataSource: DataSource,
    ) { }

    /** The migration seeds this row; self-heal if a database predates it. */
    private async ensureSettings(): Promise<StoreSetting> {
        const existing = await this.settings.findOneBy({ id: SETTINGS_ID });
        if (existing) return existing;

        const created = this.settings.create({
            id: SETTINGS_ID,
            name: 'AURELIA TECH',
            description: 'Precision hardware and high-grade accessories for discerning workspaces.',
            email: 'support@aurumtech.luxury',
            website: '',
            address: '',
            logo: '',
            mapQuery: '',
        });
        await this.settings.save(created);
        return created;
    }

    async getInfo(): Promise<StoreInfoWithDates> {
        const setting = await this.ensureSettings();
        const [phones, socialLinks] = await Promise.all([
            this.phones.find({
                where: { setting: { id: SETTINGS_ID } },
                order: { position: 'ASC' },
            }),
            this.socialLinks.find({
                where: { setting: { id: SETTINGS_ID } },
                order: { platform: 'ASC' },
            }),
        ]);

        return {
            name: setting.name,
            description: setting.description,
            logo: setting.logo,
            email: setting.email,
            website: setting.website,
            address: setting.address,
            mapQuery: setting.mapQuery,
            mapLink: toMapLink(setting.mapQuery),
            mapEmbedUrl: toMapEmbedUrl(setting.mapQuery),
            phones: phones.map((phone) => ({
                id: phone.id,
                number: phone.number,
                position: phone.position,
            })),
            socialLinks: socialLinks.map((link) => ({
                id: link.id,
                platform: link.platform,
                url: link.url,
            })),
            createdAt: setting.createdAt,
            updatedAt: setting.updatedAt,
        };
    }

    async update(dto: StoreInfoDto): Promise<StoreInfoWithDates> {
        const platforms = dto.socialLinks.map((link) => link.platform);
        if (new Set(platforms).size !== platforms.length) {
            throw new BadRequestException('Each social network can only be configured once.');
        }

        const setting = await this.ensureSettings();
        await this.dataSource.transaction(async (manager) => {
            setting.name = dto.name;
            setting.description = dto.description;
            setting.logo = dto.logo;
            setting.email = dto.email;
            setting.website = dto.website;
            setting.address = dto.address;
            setting.mapQuery = dto.mapQuery;
            await manager.save(setting);

            // Replacing both lists keeps the singleton in sync in one transaction.
            await manager.createQueryBuilder()
                .delete()
                .from(StorePhone)
                .where('"settingId" = :id', { id: SETTINGS_ID })
                .execute();
            await manager.createQueryBuilder()
                .delete()
                .from(StoreSocialLink)
                .where('"settingId" = :id', { id: SETTINGS_ID })
                .execute();

            if (dto.phones.length > 0) {
                await manager.save(
                    dto.phones.map((number, index) =>
                        manager.create(StorePhone, {
                            setting,
                            number,
                            position: index,
                        }),
                    ),
                );
            }
            if (dto.socialLinks.length > 0) {
                await manager.save(
                    dto.socialLinks.map((link) =>
                        manager.create(StoreSocialLink, {
                            setting,
                            platform: link.platform,
                            url: link.url,
                        }),
                    ),
                );
            }
        });

        return this.getInfo();
    }
}
