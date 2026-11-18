import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StockEntry } from './entities/stock-entry.entity.js';
import { Supplier } from './entities/supplier.entity.js';
import { SuppliersService } from './suppliers.service.js';

async function rejected(promise: Promise<unknown>): Promise<unknown> {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    throw new Error('Expected the promise to reject');
}

describe('SuppliersService', () => {
    let service: SuppliersService;
    let repo: Record<string, ReturnType<typeof vi.fn>>;
    let entries: { count: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        repo = {
            find: vi.fn(async () => [{ id: 's1', name: 'Acme', createdAt: new Date(), updatedAt: new Date() }]),
            findOneBy: vi.fn(async () => null),
            create: vi.fn((value: unknown) => value),
            save: vi.fn(async (value: unknown) => value),
            delete: vi.fn(async () => ({ affected: 1 })),
        };
        entries = { count: vi.fn(async () => 0) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SuppliersService,
                { provide: getRepositoryToken(Supplier), useValue: repo },
                { provide: getRepositoryToken(StockEntry), useValue: entries },
            ],
        }).compile();

        service = module.get<SuppliersService>(SuppliersService);
    });

    it('trims and creates a supplier, then detects duplicate names', async () => {
        const created = await service.create({ name: '  Acme  ' });
        expect(created.name).toBe('Acme');

        repo.findOneBy.mockResolvedValueOnce({ id: 's2', name: 'Acme' });
        const error = await rejected(service.create({ name: 'Acme' }));
        expect(error).toBeInstanceOf(ConflictException);
    });

    it('refuses to delete a supplier used by stock entries', async () => {
        repo.findOneBy.mockImplementation(async () => ({ id: 's1', name: 'Acme' }));
        entries.count.mockResolvedValueOnce(1);
        const error = await rejected(service.remove('s1'));
        expect(error).toBeInstanceOf(ConflictException);
        expect(repo.delete).not.toHaveBeenCalled();

        await service.remove('s1');
        expect(repo.delete).toHaveBeenCalledWith({ id: 's1' });
    });
});
