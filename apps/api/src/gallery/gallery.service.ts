import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
    GalleryState,
    PublicGalleryPhoto,
} from '@repo/types';
import { Repository } from 'typeorm';
import { GalleryPhotoDto } from './dto/gallery.dto.js';
import { GalleryPhoto } from './entities/gallery-photo.entity.js';
import { GallerySetting } from './entities/gallery-setting.entity.js';

/** Shared wire contract, with real Dates while inside the API. */
export type GalleryStateWithDates = GalleryState<Date>;

const SETTINGS_ID = 1;

@Injectable()
export class GalleryService {
    constructor(
        @InjectRepository(GalleryPhoto) private readonly photos: Repository<GalleryPhoto>,
        @InjectRepository(GallerySetting) private readonly settings: Repository<GallerySetting>,
    ) { }

    toPublic(photo: GalleryPhoto): PublicGalleryPhoto<Date> {
        return {
            id: photo.id,
            image: photo.image,
            name: photo.name,
            date: photo.date,
            location: photo.location,
            createdAt: photo.createdAt,
            updatedAt: photo.updatedAt,
        };
    }

    /** The migration seeds this row; self-heal if a database predates it. */
    private async ensureSettings(): Promise<GallerySetting> {
        const existing = await this.settings.findOneBy({ id: SETTINGS_ID });
        if (existing) return existing;

        const created = this.settings.create({ id: SETTINGS_ID, isActive: false });
        await this.settings.save(created);
        return created;
    }

    async getState(): Promise<GalleryStateWithDates> {
        const [setting, photos] = await Promise.all([
            this.ensureSettings(),
            this.photos.find({ order: { date: 'DESC', createdAt: 'DESC' } }),
        ]);

        return {
            isActive: setting.isActive,
            photos: photos.map((photo) => this.toPublic(photo)),
        };
    }

    async setActive(isActive: boolean): Promise<GalleryStateWithDates> {
        const setting = await this.ensureSettings();
        setting.isActive = isActive;
        await this.settings.save(setting);
        return this.getState();
    }

    async createPhoto(dto: GalleryPhotoDto): Promise<PublicGalleryPhoto<Date>> {
        const photo = this.photos.create({
            image: dto.image,
            name: dto.name,
            date: dto.date,
            location: dto.location,
        });
        const saved = await this.photos.save(photo);
        return this.toPublic(saved);
    }

    async removePhoto(id: string): Promise<void> {
        const photo = await this.photos.findOneBy({ id });
        if (!photo) throw new NotFoundException('Gallery photo not found');
        await this.photos.delete({ id });
    }
}
