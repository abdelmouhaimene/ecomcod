import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { StockEntryItem } from './entities/stock-entry-item.entity.js';
import { StockEntry } from './entities/stock-entry.entity.js';
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

describe('StockEntriesService', () => {
    let service: StockEntriesService;
    let listQuery: MockQueryBuilder;
    let rowsQuery: MockQueryBuilder;
    let manager: Record<string, ReturnType<typeof vi.fn>>;
    const productRepo = { findBy: vi.fn(async () => [{ id: 'p1' }, { id: 'p2' }]) };

    beforeEach(async () => {
        productRepo.findBy.mockClear();
        listQuery = queryBuilder([{
            id: 'entry-1',
            date: '2026-11-18',
            supplierId: 's1',
            supplier: { id: 's1', name: 'Acme' },
            adminId: 'a1',
            admin: { id: 'a1', username: 'admin' },
            total: 25,
            items: [{
                id: 'item-2',
                productId: 'p1',
                product: { id: 'p1', ref: 'sku-1', name: 'Product 1' },
                quantity: 2,
                unitPrice: 5,
                lineTotal: 10,
                createdAt: dates.createdAt,
            }],
            ...dates,
        }]);
        rowsQuery = queryBuilder([
            { productId: 'p1', quantity: 2, unitPrice: 5 },
            { productId: 'p1', quantity: 2, unitPrice: 9 },
        ]);
        manager = {
            create: vi.fn((_target: unknown, value: unknown) => value),
            save: vi.fn(async (_target: unknown, value: unknown) => ({
                ...(value as object), id: 'entry-1',
            })),
            find: vi.fn(async () => [
                { id: 'p1', quantity: 10, PMP: 5 },
                { id: 'p2', quantity: 0, PMP: 0 },
            ]),
            findOne: vi.fn(async () => ({
                id: 'entry-1',
                items: [{ productId: 'p1' }],
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
                { provide: getRepositoryToken(Supplier), useValue: { findOneBy: vi.fn(async () => ({ id: 's1' })) } },
                { provide: getRepositoryToken(Admin), useValue: { findOneBy: vi.fn(async () => ({ id: 'a1' })) } },
                {
                    provide: DataSource,
                    useValue: {
                        getRepository: () => productRepo,
                        transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(manager)),
                    },
                },
            ],
        }).compile();

        service = module.get<StockEntriesService>(StockEntriesService);
    });

    it('maps the public document with supplier, admin and product labels', async () => {
        const result = await service.findOne('entry-1');
        expect(result).toMatchObject({
            id: 'entry-1',
            date: '2026-11-18',
            supplierName: 'Acme',
            adminUsername: 'admin',
            total: 25,
            items: [{ productRef: 'sku-1', productName: 'Product 1', lineTotal: 10 }],
        });
    });

    it('applies month, year, product and supplier filters', async () => {
        await service.findAll({ month: 11, year: 2026, productId: 'p1', supplierId: 's1' });
        const andWhere = listQuery.andWhere.mock.calls.map((call) => call[0]);
        expect(andWhere).toContain('entry.date >= :startDate AND entry.date < :endDate');
        expect(andWhere.some((sql: string) => sql.includes('EXISTS'))).toBe(true);
        expect(andWhere).toContain('entry.supplierId = :supplierId');
        expect(listQuery.andWhere).toHaveBeenCalledWith(
            'entry.date >= :startDate AND entry.date < :endDate',
            { startDate: '2026-11-01', endDate: '2026-12-01' },
        );
    });

    it('creates the document and recomputes WAP in chronological order', async () => {
        rowsQuery.getMany.mockResolvedValueOnce([
            { productId: 'p1', quantity: 2, unitPrice: 5 },
            { productId: 'p1', quantity: 2, unitPrice: 9 },
            { productId: 'p2', quantity: 1, unitPrice: 10 },
        ]);
        const result = await service.create({
            date: '2026-11-18',
            supplierId: 's1',
            items: [
                { productId: 'p1', quantity: 2, unitPrice: 5 },
                { productId: 'p2', quantity: 1, unitPrice: 10 },
            ],
        }, 'a1');

        expect(result.id).toBe('entry-1');
        const savedEntry = manager.save.mock.calls[0][1] as { total: number; adminId: string };
        expect(savedEntry.total).toBe(20);
        expect(savedEntry.adminId).toBe('a1');
        expect(manager.update).toHaveBeenCalledWith(Product, 'p1', { quantity: 4, PMP: 7 });
        expect(manager.update).toHaveBeenCalledWith(Product, 'p2', { quantity: 1, PMP: 10 });
    });

    it('replays remaining entries after a deletion', async () => {
        rowsQuery.getMany.mockResolvedValueOnce([{ productId: 'p1', quantity: 2, unitPrice: 5 }]);
        manager.find.mockResolvedValueOnce([{ id: 'p1', quantity: 8, PMP: 7 }]);

        await service.remove('entry-1');

        expect(manager.delete).toHaveBeenCalledWith(StockEntryItem, { entryId: 'entry-1' });
        expect(manager.delete).toHaveBeenCalledWith(StockEntry, { id: 'entry-1' });
        expect(manager.update).toHaveBeenCalledWith(Product, 'p1', { quantity: 2, PMP: 5 });
    });
});
