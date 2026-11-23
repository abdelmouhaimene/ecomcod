import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GalleryPhoto } from './entities/gallery-photo.entity.js';
import { GallerySetting } from './entities/gallery-setting.entity.js';
import { GalleryService } from './gallery.service.js';

const dates = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

function photo(overrides: Partial<GalleryPhoto> = {}): GalleryPhoto {
    return {
        id: 'photo-1',
        image: '/uploads/gallery.jpg',
        name: 'Atelier bench',
        date: '2026-11-23',
        location: 'Algiers',
        ...dates,
        ...overrides,
    } as GalleryPhoto;
}

describe('GalleryService', () => {
    let service: GalleryService;
    let photos: Record<string, ReturnType<typeof vi.fn>>;
    let settings: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(async () => {
        photos = {
            find: vi.fn(async () => [photo()]),
            findOneBy: vi.fn(async () => photo()),
            create: vi.fn((value: Record<string, unknown>) => ({ ...value, ...dates })),
            save: vi.fn(async (value: Record<string, unknown>) => ({ ...value, id: 'photo-1', ...dates })),
            delete: vi.fn(async () => ({ affected: 1 })),
        };
        const settingRow = { id: 1, isActive: false };
        settings = {
            findOneBy: vi.fn(async () => settingRow),
            create: vi.fn((value: Record<string, unknown>) => value),
            save: vi.fn(async (value: Record<string, unknown>) => value),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GalleryService,
                { provide: getRepositoryToken(GalleryPhoto), useValue: photos },
                { provide: getRepositoryToken(GallerySetting), useValue: settings },
            ],
        }).compile();
        service = module.get(GalleryService);
    });

    it('returns the global toggle and photos in the public shape', async () => {
        await expect(service.getState()).resolves.toEqual({
            isActive: false,
            photos: [expect.objectContaining({
                id: 'photo-1',
                image: '/uploads/gallery.jpg',
                name: 'Atelier bench',
                date: '2026-11-23',
                location: 'Algiers',
            })],
        });
        expect(photos.find).toHaveBeenCalledWith({ order: { date: 'DESC', createdAt: 'DESC' } });
    });

    it('creates the singleton setting when it is missing', async () => {
        settings.findOneBy.mockResolvedValueOnce(null);
        await service.getState();

        expect(settings.create).toHaveBeenCalledWith({ id: 1, isActive: false });
        expect(settings.save).toHaveBeenCalled();
    });

    it('updates and returns the section toggle', async () => {
        const state = await service.setActive(true);

        expect(state.isActive).toBe(true);
        expect(settings.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
    });

    it('creates a photo from the admin payload', async () => {
        const result = await service.createPhoto({
            image: 'https://example.com/gallery.png',
            name: 'Front desk',
            date: '2026-10-05',
            location: 'Paris',
        });

        expect(result).toMatchObject({
            id: 'photo-1',
            name: 'Front desk',
            date: '2026-10-05',
            location: 'Paris',
        });
    });

    it('deletes an existing photo and reports missing ones', async () => {
        await expect(service.removePhoto('photo-1')).resolves.toBeUndefined();
        expect(photos.delete).toHaveBeenCalledWith({ id: 'photo-1' });

        photos.findOneBy.mockResolvedValueOnce(null);
        await expect(service.removePhoto('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
});
