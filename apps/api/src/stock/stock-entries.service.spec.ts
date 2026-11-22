import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { StockEntryPayload } from '@repo/types';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { CacheService } from '../cache/cache.service.js';
import { ProductSku } from '../products/entities/product-sku.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { StockEntryItem } from './entities/stock-entry-item.entity.js';
import { StockEntry } from './entities/stock-entry.entity.js';
import { StockMovement } from './entities/stock-movement.entity.js';
import { Supplier } from './entities/supplier.entity.js';
import { StockEntriesService } from './stock-entries.service.js';

type MockQueryBuilder = Record<string, ReturnType<typeof vi.fn>>;

function queryBuilder(result: unknown[] = []): MockQueryBuilder {
    const qb: MockQueryBuilder = {};
    for (const method of [
        'leftJoinAndSelect', 'innerJoin', 'select', 'where', 'andWhere', 'orderBy', 'addOrderBy',
    ]) {
        qb[method] = vi.fn(() => qb);
    }
    qb.getMany = vi.fn(async () => result);
    qb.getOne = vi.fn(async () => result[0] ?? null);
    return qb;
}

const dates = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const product1 = { id: 'p1', ref: 'sku-1', name: 'Product 1' };
const product2 = { id: 'p2', ref: 'sku-2', name: 'Product 2' };

const skus = [
    {
        id: 'sku-1', productId: 'p1', sku: 'SKU1', label: 'Red',
        isActive: true, stockQuantity: 0, PMP: 0, product: product1, ...dates,
    },
    {
        id: 'sku-2', productId: 'p1', sku: 'SKU2', label: 'Blue',
        isActive: true, stockQuantity: 0, PMP: 0, product: product1, ...dates,
    },
    {
        id: 'sku-3', productId: 'p2', sku: 'SKU3', label: 'Green',
        isActive: true, stockQuantity: 0, PMP: 0, product: product2, ...dates,
    },
];

const products = [
    { id: 'p1', quantity: 0, PMP: 0 },
    { id: 'p2', quantity: 0, PMP: 0 },
];

function entryPayload(
    combinations: Array<{ skuId: string; quantity: number }> = [
        { skuId: 'sku-1', quantity: 2 },
        { skuId: 'sku-2', quantity: 1 },
    ],
    totalQuantity = 3,
): StockEntryPayload {
    return {
        date: '2026-11-18',
        supplierId: 's1',
        items: [{ productId: 'p1', buyingPrice: 5, totalQuantity, combinations }],
    };
}

/** TypeORM's `In()` stores its ids in `_value` in this version. */
type IdFilter = {
    where?: {
        id?: { _value?: string[] };
        productId?: { _value?: string[] };
        isActive?: boolean;
    };
};

describe('StockEntriesService', () => {
    let service: StockEntriesService;
    let listQuery: MockQueryBuilder;
    let rowsQuery: MockQueryBuilder;
    let manager: Record<string, ReturnType<typeof vi.fn>>;
    let skuRepo: { find: ReturnType<typeof vi.fn> };
    let productsRepo: { find: ReturnType<typeof vi.fn> };
    let cacheInvalidate: ReturnType<typeof vi.fn>;
    let replayedSkus: typeof skus;

    beforeEach(async () => {
        replayedSkus = skus;
        listQuery = queryBuilder([{
            id: 'entry-1',
            date: '2026-11-18',
            supplierId: 's1',
            supplier: { id: 's1', name: 'Acme' },
            adminId: 'a1',
            admin: { id: 'a1', username: 'admin' },
            total: 25,
            items: [{
                id: 'item-1',
                productId: 'p1',
                product: product1,
                buyingPrice: 5,
                totalQuantity: 3,
                lineTotal: 15,
                combinations: [
                    {
                        id: 'combo-1', skuId: 'sku-1',
                        sku: { id: 'sku-1', sku: 'SKU1', label: 'Red' },
                        quantity: 2, createdAt: dates.createdAt,
                    },
                    {
                        id: 'combo-2', skuId: 'sku-2',
                        sku: { id: 'sku-2', sku: 'SKU2', label: 'Blue' },
                        quantity: 1, createdAt: dates.createdAt,
                    },
                ],
                createdAt: dates.createdAt,
            }],
            ...dates,
        }]);
        rowsQuery = queryBuilder([]);
        skuRepo = { find: vi.fn(async (options?: IdFilter) => {
            const ids = options?.where?.id?._value;
            const productIds = options?.where?.productId?._value;
            const isActive = options?.where?.isActive;
            return skus.filter((sku) =>
                (!ids || ids.includes(sku.id)) &&
                (!productIds || productIds.includes(sku.productId)) &&
                (isActive === undefined || sku.isActive === isActive));
        }) };
        productsRepo = { find: vi.fn(async (options?: IdFilter) => {
            const ids = options?.where?.id?._value;
            return products
                .filter((product) => !ids || ids.includes(product.id))
                .map((product) => ({ ...product }));
        }) };
        cacheInvalidate = vi.fn(async () => undefined);

        manager = {
            create: vi.fn((_target: unknown, value: unknown) => value),
            save: vi.fn(async (_target: unknown, value: unknown) => ({
                ...(value as object), id: 'entry-1',
            })),
            find: vi.fn(async (target: { name?: string }, options?: IdFilter) => {
                if (target?.name === 'Product') {
                    const ids = options?.where?.id?._value;
                    return products
                        .filter((product) => !ids || ids.includes(product.id))
                        .map((product) => ({ ...product }));
                }
                if (target?.name === 'ProductSku') {
                    const source = options?.where?.isActive === true ? replayedSkus : skus;
                    const ids = options?.where?.id?._value;
                    const productIds = options?.where?.productId?._value;
                    return source
                        .filter((sku) =>
                            (!ids || ids.includes(sku.id)) &&
                            (!productIds || productIds.includes(sku.productId)))
                        .map((sku) => ({
                            id: sku.id,
                            productId: sku.productId,
                            isActive: sku.isActive,
                            stockQuantity: sku.stockQuantity,
                            PMP: sku.PMP,
                        }));
                }
                return [];
            }),
            findOne: vi.fn(async () => ({
                id: 'entry-1',
                items: [{ id: 'item-1', productId: 'p1', combinations: [{ skuId: 'sku-1' }] }],
            })),
            delete: vi.fn(async () => ({ affected: 1 })),
            update: vi.fn(async () => ({ affected: 1 })),
            createQueryBuilder: vi.fn(() => rowsQuery),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StockEntriesService,
                { provide: getRepositoryToken(StockEntry), useValue: { createQueryBuilder: () => listQuery } },
                { provide: getRepositoryToken(StockEntryItem), useValue: {} },
                { provide: getRepositoryToken(StockMovement), useValue: {} },
                { provide: getRepositoryToken(ProductSku), useValue: skuRepo },
                { provide: getRepositoryToken(Product), useValue: productsRepo },
                { provide: getRepositoryToken(Supplier), useValue: { findOneBy: vi.fn(async () => ({ id: 's1' })) } },
                { provide: getRepositoryToken(Admin), useValue: { findOneBy: vi.fn(async () => ({ id: 'a1' })) } },
                { provide: CacheService, useValue: {
                    getOrSet: vi.fn(async (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader()),
                    invalidate: cacheInvalidate,
                } },
                {
                    provide: DataSource,
                    useValue: {
                        transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(manager)),
                    },
                },
            ],
        }).compile();

        service = module.get<StockEntriesService>(StockEntriesService);
    });

    function saved(targetName: string): Array<Record<string, unknown>> {
        return manager.save.mock.calls
            .filter((call) => call[0]?.name === targetName)
            .map((call) => call[1] as Record<string, unknown>);
    }

    function savedCombinations(): Array<Record<string, unknown>> {
        return manager.save.mock.calls
            .filter((call) => call[0]?.name === 'StockEntryCombination')
            .flatMap((call) => call[1] as Array<Record<string, unknown>>);
    }

    function savedMovements(): Array<Record<string, unknown>> {
        return manager.save.mock.calls
            .filter((call) => call[0]?.name === 'StockMovement')
            .flatMap((call) => call[1] as Array<Record<string, unknown>>);
    }

    it('maps the public document with product-level items and combination lines', async () => {
        const result = await service.findOne('entry-1');
        expect(result).toMatchObject({
            id: 'entry-1',
            date: '2026-11-18',
            supplierName: 'Acme',
            adminUsername: 'admin',
            total: 25,
            items: [{
                productId: 'p1',
                productRef: 'sku-1',
                productName: 'Product 1',
                buyingPrice: 5,
                totalQuantity: 3,
                lineTotal: 15,
                combinations: [
                    { skuId: 'sku-1', sku: 'SKU1', skuLabel: 'Red', quantity: 2 },
                    { skuId: 'sku-2', sku: 'SKU2', skuLabel: 'Blue', quantity: 1 },
                ],
            }],
        });
    });

    it('applies month, year, SKU, product and supplier filters', async () => {
        await service.findAll({
            month: 11,
            year: 2026,
            productId: 'p1',
            skuId: 'sku-1',
            supplierId: 's1',
        });
        const andWhere = listQuery.andWhere.mock.calls.map((call) => call[0]);
        expect(andWhere).toContain('entry.date >= :startDate AND entry.date < :endDate');
        expect(andWhere.some((sql: string) => sql.includes('EXISTS'))).toBe(true);
        expect(andWhere).toContain('combination.skuId = :skuId');
        expect(andWhere).toContain('entry.supplierId = :supplierId');
        expect(listQuery.andWhere).toHaveBeenCalledWith(
            'entry.date >= :startDate AND entry.date < :endDate',
            { startDate: '2026-11-01', endDate: '2026-12-01' },
        );
    });

    it('creates product-level lines, ENTRY movements and replays SKU/PMP chronologically', async () => {
        replayedSkus = [
            { ...skus[0], stockQuantity: 2, PMP: 5 },
            { ...skus[1], stockQuantity: 1, PMP: 5 },
            { ...skus[2], stockQuantity: 1, PMP: 10 },
        ];
        rowsQuery.getMany.mockResolvedValueOnce([
            { skuId: 'sku-1', sourceType: 'ENTRY', quantity: 2, unitPrice: 5 },
            { skuId: 'sku-2', sourceType: 'ENTRY', quantity: 1, unitPrice: 5 },
            { skuId: 'sku-3', sourceType: 'ENTRY', quantity: 1, unitPrice: 10 },
        ]);

        const result = await service.create({
            date: '2026-11-18',
            supplierId: 's1',
            items: [
                {
                    productId: 'p1', buyingPrice: 5, totalQuantity: 3,
                    combinations: [{ skuId: 'sku-1', quantity: 2 }, { skuId: 'sku-2', quantity: 1 }],
                },
                {
                    productId: 'p2', buyingPrice: 10, totalQuantity: 1,
                    combinations: [{ skuId: 'sku-3', quantity: 1 }],
                },
            ],
        }, 'a1');

        expect(result.id).toBe('entry-1');
        const savedEntry = saved('StockEntry')[0] as { total: number; adminId: string };
        expect(savedEntry.total).toBe(25);
        expect(savedEntry.adminId).toBe('a1');

        expect(saved('StockEntryItem')).toMatchObject([
            { productId: 'p1', buyingPrice: 5, totalQuantity: 3, lineTotal: 15 },
            { productId: 'p2', buyingPrice: 10, totalQuantity: 1, lineTotal: 10 },
        ]);
        expect(savedCombinations()).toMatchObject([
            { skuId: 'sku-1', quantity: 2 },
            { skuId: 'sku-2', quantity: 1 },
            { skuId: 'sku-3', quantity: 1 },
        ]);
        expect(savedMovements()).toMatchObject([
            { skuId: 'sku-1', quantity: 2, unitPrice: 5, sourceType: 'ENTRY' },
            { skuId: 'sku-2', quantity: 1, unitPrice: 5, sourceType: 'ENTRY' },
            { skuId: 'sku-3', quantity: 1, unitPrice: 10, sourceType: 'ENTRY' },
        ]);

        expect(manager.update).toHaveBeenCalledWith(ProductSku, 'sku-1', { stockQuantity: 2, PMP: 5 });
        expect(manager.update).toHaveBeenCalledWith(ProductSku, 'sku-2', { stockQuantity: 1, PMP: 5 });
        expect(manager.update).toHaveBeenCalledWith(ProductSku, 'sku-3', { stockQuantity: 1, PMP: 10 });
        expect(manager.update).toHaveBeenCalledWith(Product, 'p1', { quantity: 3, PMP: 5 });
        expect(manager.update).toHaveBeenCalledWith(Product, 'p2', { quantity: 1, PMP: 10 });
        expect(cacheInvalidate).toHaveBeenCalled();
    });

    it('skips movements for zero-quantity combinations but still stores the lines', async () => {
        replayedSkus = [
            { ...skus[0], stockQuantity: 2, PMP: 5 },
            { ...skus[1], stockQuantity: 0, PMP: 0 },
        ];
        rowsQuery.getMany.mockResolvedValueOnce([
            { skuId: 'sku-1', sourceType: 'ENTRY', quantity: 2, unitPrice: 5 },
        ]);

        await service.create(entryPayload([
            { skuId: 'sku-1', quantity: 2 },
            { skuId: 'sku-2', quantity: 0 },
        ], 2), 'a1');

        expect(savedCombinations()).toMatchObject([
            { skuId: 'sku-1', quantity: 2 },
            { skuId: 'sku-2', quantity: 0 },
        ]);
        expect(savedMovements()).toMatchObject([
            { skuId: 'sku-1', quantity: 2, unitPrice: 5, sourceType: 'ENTRY' },
        ]);
    });

    it('enforces the strict sum when called directly', async () => {
        const tooFew = await service.create({
            date: '2026-11-18',
            supplierId: 's1',
            items: [{
                productId: 'p1', buyingPrice: 5, totalQuantity: 5,
                combinations: [{ skuId: 'sku-1', quantity: 2 }, { skuId: 'sku-2', quantity: 1 }],
            }],
        }, 'a1').catch((error: unknown) => error);
        expect(tooFew).toBeInstanceOf(BadRequestException);
        expect((tooFew as Error).message).toBe(
            'Combination quantities (3) are less than totalQuantity (5).',
        );

        const tooMany = await service.create({
            date: '2026-11-18',
            supplierId: 's1',
            items: [{
                productId: 'p1', buyingPrice: 5, totalQuantity: 2,
                combinations: [{ skuId: 'sku-1', quantity: 2 }, { skuId: 'sku-2', quantity: 1 }],
            }],
        }, 'a1').catch((error: unknown) => error);
        expect(tooMany).toBeInstanceOf(BadRequestException);
        expect((tooMany as Error).message).toBe(
            'Combination quantities (3) are greater than totalQuantity (2).',
        );
        expect(manager.save).not.toHaveBeenCalled();
    });

    it('requires every active SKU, rejects inactive SKUs and validates references', async () => {
        const incomplete = await service.create(entryPayload([
            { skuId: 'sku-1', quantity: 3 },
        ]), 'a1').catch((error: unknown) => error);
        expect(incomplete).toBeInstanceOf(BadRequestException);
        expect((incomplete as Error).message).toBe('All active combinations of a product must be listed.');

        skuRepo.find.mockResolvedValueOnce([{ ...skus[0], isActive: false }]);
        const inactive = await service.create(entryPayload([
            { skuId: 'sku-1', quantity: 3 },
        ]), 'a1').catch((error: unknown) => error);
        expect(inactive).toBeInstanceOf(BadRequestException);
        expect((inactive as Error).message).toBe('Inactive SKUs cannot receive stock.');

        skuRepo.find.mockResolvedValueOnce([]);
        const missingSku = await service.create(entryPayload([
            { skuId: 'sku-1', quantity: 3 },
        ]), 'a1').catch((error: unknown) => error);
        expect(missingSku).toBeInstanceOf(NotFoundException);
        expect((missingSku as Error).message).toBe('One or more SKUs were not found.');

        productsRepo.find.mockResolvedValueOnce([]);
        const missingProduct = await service.create(entryPayload(), 'a1')
            .catch((error: unknown) => error);
        expect(missingProduct).toBeInstanceOf(NotFoundException);
        expect((missingProduct as Error).message).toBe('One or more products were not found.');

        skuRepo.find.mockResolvedValueOnce([skus[2]]);
        const foreign = await service.create({
            date: '2026-11-18',
            supplierId: 's1',
            items: [{
                productId: 'p1', buyingPrice: 5, totalQuantity: 3,
                combinations: [{ skuId: 'sku-3', quantity: 3 }],
            }],
        }, 'a1').catch((error: unknown) => error);
        expect(foreign).toBeInstanceOf(BadRequestException);
        expect((foreign as Error).message).toBe('A combination does not belong to its product.');
    });

    it('replays remaining movements after a deletion without removing SALE history', async () => {
        replayedSkus = [{ ...skus[0], stockQuantity: 1, PMP: 5 }];
        rowsQuery.getMany.mockResolvedValueOnce([
            { skuId: 'sku-1', sourceType: 'ENTRY', quantity: 2, unitPrice: 5 },
            { skuId: 'sku-1', sourceType: 'SALE', quantity: -1, unitPrice: 0 },
        ]);
        manager.find.mockImplementationOnce(async (target: { name?: string }) =>
            target?.name === 'ProductSku' ? [{ id: 'sku-1', productId: 'p1', stockQuantity: 8, PMP: 7 }] : [],
        );

        await service.remove('entry-1');

        expect(manager.delete).toHaveBeenCalledWith(StockMovement, { stockEntryId: 'entry-1' });
        expect(manager.delete).toHaveBeenCalledWith(StockEntryItem, { entryId: 'entry-1' });
        expect(manager.delete).toHaveBeenCalledWith(StockEntry, { id: 'entry-1' });
        expect(manager.update).toHaveBeenCalledWith(ProductSku, 'sku-1', { stockQuantity: 1, PMP: 5 });
    });

    it('returns a cached per-SKU availability snapshot', async () => {
        const result = await service.availability();

        expect(result[0]).toMatchObject({
            skuId: 'sku-1',
            productId: 'p1',
            sku: 'SKU1',
            label: 'Red',
            productRef: 'sku-1',
            productName: 'Product 1',
            stockQuantity: 0,
        });
        expect(skuRepo.find).toHaveBeenCalledWith(expect.objectContaining({
            where: { isActive: true },
            relations: { product: true },
        }));
    });
});
