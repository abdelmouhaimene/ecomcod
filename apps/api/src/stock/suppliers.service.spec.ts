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
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    const stored: Supplier = {
        id: 's1',
        name: 'Acme',
        address: '12 Rue de Paris',
        phone: '0102030405',
        email: 'buyer@acme.test',
        description: 'Preferred partner',
        entries: [],
        createdAt,
        updatedAt,
    };

    let service: SuppliersService;
    let repo: Record<string, ReturnType<typeof vi.fn>>;
    let entries: { count: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        repo = {
            find: vi.fn(async () => [stored]),
            findOneBy: vi.fn(async () => null),
            create: vi.fn((value: unknown) => ({
                ...(value as object),
                id: 's1',
                createdAt,
                updatedAt,
            })),
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

    it('trims and creates a supplier with all contacts, then detects duplicate names', async () => {
        const created = await service.create({
            name: '  Acme  ',
            address: '  12 Rue de Paris  ',
            phone: '  0102030405  ',
            email: '  buyer@acme.test  ',
            description: '  Preferred partner  ',
        });

        expect(repo.create).toHaveBeenCalledWith({
            name: 'Acme',
            address: '12 Rue de Paris',
            phone: '0102030405',
            email: 'buyer@acme.test',
            description: 'Preferred partner',
        });
        expect(created).toEqual({
            id: 's1',
            name: 'Acme',
            address: '12 Rue de Paris',
            phone: '0102030405',
            email: 'buyer@acme.test',
            description: 'Preferred partner',
            createdAt,
            updatedAt,
        });

        repo.findOneBy.mockResolvedValueOnce({ id: 's2', name: 'Acme' });
        const error = await rejected(service.create({ name: 'Acme' }));
        expect(error).toBeInstanceOf(ConflictException);
    });

    it('stores blank contact values as null on create', async () => {
        const created = await service.create({
            name: 'Blank',
            address: '   ',
            phone: '',
            email: '\t',
            description: ' \n ',
        });

        expect(repo.create).toHaveBeenCalledWith({
            name: 'Blank',
            address: null,
            phone: null,
            email: null,
            description: null,
        });
        expect(created.address).toBeNull();
        expect(created.phone).toBeNull();
        expect(created.email).toBeNull();
        expect(created.description).toBeNull();
    });

    it('maps stored contacts in list and single-supplier reads', async () => {
        const expected = {
            id: 's1',
            name: 'Acme',
            address: '12 Rue de Paris',
            phone: '0102030405',
            email: 'buyer@acme.test',
            description: 'Preferred partner',
            createdAt,
            updatedAt,
        };
        expect(await service.findAll()).toEqual([expected]);

        repo.findOneBy.mockResolvedValueOnce(stored);
        expect(await service.findOne('s1')).toEqual(expected);
    });

    it('persists and clears contacts on update while keeping the unique-name guard', async () => {
        repo.findOneBy.mockResolvedValueOnce(stored).mockResolvedValueOnce(null);
        const updated = await service.update('s1', {
            name: '  Acme  ',
            address: '  ',
            phone: '',
            email: '  new@acme.test  ',
            description: null,
        });

        expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Acme',
            address: null,
            phone: null,
            email: 'new@acme.test',
            description: null,
        }));
        expect(updated.address).toBeNull();
        expect(updated.phone).toBeNull();
        expect(updated.email).toBe('new@acme.test');
        expect(updated.description).toBeNull();

        repo.findOneBy.mockResolvedValueOnce(stored).mockResolvedValueOnce({ id: 's2', name: 'Acme' });
        const error = await rejected(service.update('s1', { name: 'Acme' }));
        expect(error).toBeInstanceOf(ConflictException);
        expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('refuses to delete a supplier used by stock entries', async () => {
        repo.findOneBy.mockImplementation(async () => stored);
        entries.count.mockResolvedValueOnce(1);
        const error = await rejected(service.remove('s1'));
        expect(error).toBeInstanceOf(ConflictException);
        expect(repo.delete).not.toHaveBeenCalled();

        await service.remove('s1');
        expect(repo.delete).toHaveBeenCalledWith({ id: 's1' });
    });
});
