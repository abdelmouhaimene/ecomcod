import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CacheService } from '../cache/cache.service.js';
import { Family } from './entities/family.entity.js';
import { FamiliesService } from './families.service.js';

const dates = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('FamiliesService', () => {
    let service: FamiliesService;
    let repo: Record<string, ReturnType<typeof vi.fn>>;
    let invalidate: ReturnType<typeof vi.fn>;
    let invalidatePrefix: ReturnType<typeof vi.fn>;
    let qb: { select: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn>; getMany: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        invalidate = vi.fn(async () => undefined);
        invalidatePrefix = vi.fn(async () => undefined);
        qb = {
            select: vi.fn(() => qb),
            where: vi.fn(() => qb),
            getMany: vi.fn(async () => []),
        };
        repo = {
            find: vi.fn(async () => [{ id: 'f1', name: 'Audio', ref: 'audio', description: null, ...dates }]),
            findOneBy: vi.fn(async () => ({ id: 'f1', name: 'Audio', ref: 'audio', description: null, ...dates })),
            create: vi.fn((value: unknown) => value),
            save: vi.fn(async (value: Record<string, unknown>) => ({ ...value, id: 'f1', ...dates })),
            delete: vi.fn(async () => ({ affected: 1 })),
            query: vi.fn(async () => [{ count: 0 }]),
            createQueryBuilder: vi.fn(() => qb),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FamiliesService,
                { provide: getRepositoryToken(Family), useValue: repo },
                { provide: CacheService, useValue: {
                    getOrSet: vi.fn(async (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader()),
                    invalidate,
                    invalidatePrefix,
                } },
            ],
        }).compile();
        service = module.get<FamiliesService>(FamiliesService);
    });

    it('maps a family to the public contract', () => {
        expect(service.toPublic({
            id: 'f1', name: 'Audio', ref: 'audio', description: null, ...dates,
        } as Family)).toMatchObject({
            id: 'f1', name: 'Audio', ref: 'audio', description: null,
        });
    });

    it('lists and reads families', async () => {
        await expect(service.findAll()).resolves.toHaveLength(1);
        await expect(service.findOne('f1')).resolves.toMatchObject({ ref: 'audio' });
        repo.findOneBy.mockResolvedValueOnce(null);
        await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a family and invalidates the cache', async () => {
        await expect(service.create({
            name: ' Audio ', ref: 'audio', description: '  Group  ',
        })).resolves.toMatchObject({ name: 'Audio', description: 'Group' });
        expect(repo.save).toHaveBeenCalled();
        expect(invalidate).toHaveBeenCalled();
    });

    it('rejects duplicate names and refs', async () => {
        qb.getMany.mockResolvedValueOnce([
            { id: 'other', name: 'Audio', ref: 'other' },
        ]);
        await expect(service.create({ name: 'Audio', ref: 'new-ref' }))
            .rejects.toBeInstanceOf(ConflictException);
    });

    it('deletes a family even when products still use it', async () => {
        repo.query.mockResolvedValueOnce([{ count: 2 }]);
        await service.remove('f1');
        expect(repo.delete).toHaveBeenCalledWith({ id: 'f1' });
        expect(invalidate).toHaveBeenCalled();
        expect(invalidatePrefix).toHaveBeenCalled();
    });

    it('deletes an unused family', async () => {
        await service.remove('f1');
        expect(repo.delete).toHaveBeenCalledWith({ id: 'f1' });
        expect(invalidate).toHaveBeenCalled();
    });
});
