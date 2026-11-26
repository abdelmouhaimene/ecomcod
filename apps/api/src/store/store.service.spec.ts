import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StorePhone } from './entities/store-phone.entity.js';
import { StoreSetting } from './entities/store-setting.entity.js';
import { StoreSocialLink } from './entities/store-social-link.entity.js';
import { StoreService } from './store.service.js';

const timestamps = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const payload = {
    name: 'Aurelia Tech',
    description: 'Precision hardware.',
    logo: '/uploads/logo.png',
    email: 'hello@example.com',
    website: 'https://example.com',
    address: 'Algiers',
    mapQuery: '36.7538, 3.0588',
    homeVideoEnabled: true,
    homeVideoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    phones: ['+213 555 000 001', '+213 555 000 002'],
    socialLinks: [
        { platform: 'instagram' as const, url: 'https://instagram.com/aurelia' },
        { platform: 'ouedkniss' as const, url: 'https://ouedkniss.com/aurelia' },
    ],
};

describe('StoreService', () => {
    let service: StoreService;
    let settings: Record<string, ReturnType<typeof vi.fn>>;
    let phones: Record<string, ReturnType<typeof vi.fn>>;
    let socialLinks: Record<string, ReturnType<typeof vi.fn>>;
    let manager: Record<string, ReturnType<typeof vi.fn>>;
    let transaction: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        const settingRow = {
            id: 1,
            name: 'AURELIA TECH',
            description: 'Precision hardware.',
            logo: '',
            email: 'support@aurumtech.luxury',
            website: '',
            address: '',
            mapQuery: '36.7538, 3.0588',
            homeVideoEnabled: true,
            homeVideoUrl: 'https://youtu.be/dQw4w9WgXcQ',
            ...timestamps,
        };
        settings = {
            findOneBy: vi.fn(async () => settingRow),
            create: vi.fn((value: Record<string, unknown>) => value),
            save: vi.fn(async (value: Record<string, unknown>) => value),
        };
        phones = {
            find: vi.fn(async () => [{ id: 'phone-1', number: '+1 800 450', position: 0 }]),
        };
        socialLinks = {
            find: vi.fn(async () => [
                { id: 'link-1', platform: 'instagram', url: 'https://instagram.com/x' },
            ]),
        };

        const queryBuilder = {
            delete: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn(async () => ({ affected: 1 })),
        };
        manager = {
            save: vi.fn(async (value: unknown) => value),
            create: vi.fn((entity: new () => unknown, value: Record<string, unknown>) => ({
                id: `${entity.name}-new`,
                ...value,
            })),
            createQueryBuilder: vi.fn(() => queryBuilder),
        };
        transaction = vi.fn(async (callback: (value: unknown) => unknown) => callback(manager));

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StoreService,
                { provide: getRepositoryToken(StoreSetting), useValue: settings },
                { provide: getRepositoryToken(StorePhone), useValue: phones },
                { provide: getRepositoryToken(StoreSocialLink), useValue: socialLinks },
                { provide: DataSource, useValue: { transaction } },
            ],
        }).compile();
        service = module.get(StoreService);
    });

    it('returns the public store contract with derived map URLs', async () => {
        const info = await service.getInfo();

        expect(info).toMatchObject({
            name: 'AURELIA TECH',
            email: 'support@aurumtech.luxury',
            mapLink: 'https://www.google.com/maps?q=36.7538,3.0588',
            phones: [{ id: 'phone-1', number: '+1 800 450', position: 0 }],
            socialLinks: [{ id: 'link-1', platform: 'instagram' }],
        });
        expect(info.mapEmbedUrl).toContain('output=embed');
        expect(info.homeVideoEnabled).toBe(true);
        expect(info.homeVideoEmbedUrl).toContain('/embed/dQw4w9WgXcQ');
    });

    it('seeds the singleton settings row when missing', async () => {
        settings.findOneBy.mockResolvedValueOnce(null);
        await service.getInfo();

        expect(settings.create).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
        expect(settings.save).toHaveBeenCalled();
    });

    it('rejects duplicate social platforms', async () => {
        await expect(
            service.update({
                ...payload,
                socialLinks: [
                    { platform: 'facebook', url: 'https://facebook.com/a' },
                    { platform: 'facebook', url: 'https://facebook.com/b' },
                ],
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(transaction).not.toHaveBeenCalled();
    });

    it('saves settings and replaces both contact lists in one transaction', async () => {
        await service.update(payload);

        expect(transaction).toHaveBeenCalledTimes(1);
        expect(manager.save).toHaveBeenCalledTimes(3);
        expect(manager.save).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Aurelia Tech',
                mapQuery: '36.7538, 3.0588',
                homeVideoEnabled: true,
                homeVideoUrl: 'https://youtu.be/dQw4w9WgXcQ',
            })
        );
        expect(manager.save).toHaveBeenCalledWith([
            expect.objectContaining({ number: '+213 555 000 001', position: 0 }),
            expect.objectContaining({ number: '+213 555 000 002', position: 1 }),
        ]);
        expect(manager.save).toHaveBeenCalledWith([
            expect.objectContaining({ platform: 'instagram' }),
            expect.objectContaining({ platform: 'ouedkniss' }),
        ]);
        expect(manager.createQueryBuilder).toHaveBeenCalledTimes(2);
    });
});
