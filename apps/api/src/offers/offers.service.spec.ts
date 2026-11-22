import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service.js';
import { Product } from '../products/entities/product.entity.js';
import { OfferDto } from './dto/offer.dto.js';
import { OfferPackItem } from './entities/offer-pack-item.entity.js';
import { OfferSingleRule } from './entities/offer-single-rule.entity.js';
import { Offer } from './entities/offer.entity.js';
import { OffersService } from './offers.service.js';

const dates = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const productId = '11111111-1111-4111-8111-111111111111';
const otherProductId = '22222222-2222-4222-8222-222222222222';

function singleDto(overrides: Partial<OfferDto> = {}): OfferDto {
    return {
        name: 'Buy 2 get 1',
        type: 'SINGLE_PRODUCT',
        isActive: true,
        singleRule: {
            productId,
            mode: 'BUY_X_GET_Y_FREE',
            buyQuantity: 2,
            freeQuantity: 1,
        },
        ...overrides,
    } as OfferDto;
}

function packDto(overrides: Partial<OfferDto> = {}): OfferDto {
    return {
        name: 'Bundle',
        type: 'PACK',
        isActive: true,
        packPrice: 40,
        packItems: [
            { productId, quantity: 1 },
            { productId: otherProductId, quantity: 1 },
        ],
        ...overrides,
    } as OfferDto;
}

describe('OffersService', () => {
    let service: OffersService;
    let repo: Record<string, ReturnType<typeof vi.fn>>;
    let rules: { delete: ReturnType<typeof vi.fn> };
    let packItems: { delete: ReturnType<typeof vi.fn> };
    let productRepo: { find: ReturnType<typeof vi.fn> };
    let manager: Record<string, ReturnType<typeof vi.fn>>;
    let invalidate: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        invalidate = vi.fn(async () => undefined);
        const persisted = {
            id: 'offer-1',
            name: 'Buy 2 get 1',
            type: 'SINGLE_PRODUCT',
            isActive: true,
            startsAt: null,
            endsAt: null,
            packPrice: null,
            singleRule: {
                id: 'rule-1', offerId: 'offer-1', productId,
                mode: 'BUY_X_GET_Y_FREE', buyQuantity: 2, freeQuantity: 1, ...dates,
            },
            packItems: [],
            ...dates,
        };
        const qb = {
            leftJoinAndSelect: vi.fn(() => qb),
            where: vi.fn(() => qb),
            andWhere: vi.fn(() => qb),
            orderBy: vi.fn(() => qb),
            getMany: vi.fn(async () => [persisted]),
        };
        repo = {
            find: vi.fn(async () => [persisted]),
            findOne: vi.fn(async () => persisted),
            findOneBy: vi.fn(async () => persisted),
            delete: vi.fn(async () => ({ affected: 1 })),
            createQueryBuilder: vi.fn(() => qb),
        };
        rules = { delete: vi.fn(async () => ({ affected: 1 })) };
        packItems = { delete: vi.fn(async () => ({ affected: 1 })) };
        productRepo = { find: vi.fn(async (options?: { where?: { id?: { value?: string[] } } }) => {
            const ids = options?.where?.id?.value ?? [];
            return [{ id: productId }, { id: otherProductId }]
                .filter((product) => ids.length === 0 || ids.includes(product.id));
        }) };
        manager = {
            create: vi.fn((_target: unknown, value: unknown) => value),
            save: vi.fn(async (target: { name?: string }, value: Record<string, unknown>) => ({
                ...value,
                id: value.id ?? `saved-${target?.name}`,
            })),
            delete: vi.fn(async () => ({ affected: 1 })),
            update: vi.fn(async () => ({ affected: 1 })),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OffersService,
                { provide: getRepositoryToken(Offer), useValue: repo },
                { provide: getRepositoryToken(OfferSingleRule), useValue: rules },
                { provide: getRepositoryToken(OfferPackItem), useValue: packItems },
                { provide: getRepositoryToken(Product), useValue: productRepo },
                {
                    provide: CacheService,
                    useValue: {
                        getOrSet: vi.fn(async (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader()),
                        invalidate,
                    },
                },
                {
                    provide: DataSource,
                    useValue: {
                        transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(manager)),
                    },
                },
            ],
        }).compile();
        service = module.get<OffersService>(OffersService);
    });

    it('maps a single-product offer to the public contract', async () => {
        const result = await service.findOne('offer-1');
        expect(result).toMatchObject({
            type: 'SINGLE_PRODUCT',
            singleRule: { productId, mode: 'BUY_X_GET_Y_FREE', freeQuantity: 1 },
            packItems: [],
        });
        expect(result.singleRule).not.toHaveProperty('skuId');
    });

    it('returns active offers from the cache loader', async () => {
        await expect(service.findActive()).resolves.toHaveLength(1);
        expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('creates a single-product offer with its rule', async () => {
        await expect(service.create(singleDto())).resolves.toMatchObject({ id: 'offer-1' });
        expect(manager.save).toHaveBeenCalledWith(
            OfferSingleRule,
            expect.objectContaining({ productId, mode: 'BUY_X_GET_Y_FREE', freeQuantity: 1 }),
        );
        expect(manager.save).toHaveBeenCalledWith(
            OfferSingleRule,
            expect.not.objectContaining({ skuId: expect.anything() }),
        );
        expect(invalidate).toHaveBeenCalled();
    });

    it('rejects unknown products', async () => {
        productRepo.find.mockResolvedValueOnce([]);
        await expect(service.create(singleDto())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a pack with the same product twice', async () => {
        await expect(service.create(packDto({
            packItems: [
                { productId, quantity: 1 },
                { productId, quantity: 2 },
            ],
        }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates pack items and removes old children on update', async () => {
        repo.findOne.mockResolvedValueOnce({
            id: 'offer-1', name: 'Old', type: 'PACK', isActive: true,
            startsAt: null, endsAt: null, packPrice: 30,
            singleRule: null, packItems: [], ...dates,
        });
        await service.update('offer-1', packDto());

        expect(manager.delete).toHaveBeenCalledWith(OfferSingleRule, { offerId: 'offer-1' });
        expect(manager.delete).toHaveBeenCalledWith(OfferPackItem, { offerId: 'offer-1' });
        expect(manager.save).toHaveBeenCalledWith(
            OfferPackItem,
            expect.objectContaining({ productId, quantity: 1 }),
        );
        expect(manager.save).toHaveBeenCalledWith(
            OfferPackItem,
            expect.not.objectContaining({ skuId: expect.anything() }),
        );
    });

    it('reports missing offers', async () => {
        repo.findOneBy.mockResolvedValueOnce(null);
        await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
});
