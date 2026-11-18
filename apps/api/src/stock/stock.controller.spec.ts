import { Test, TestingModule } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import { ADMIN_ROLES_KEY } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { StockEntriesController } from './stock-entries.controller.js';
import { StockEntriesService } from './stock-entries.service.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

describe('Stock controllers', () => {
    const entry = { id: 'entry-1', date: '2026-11-18' };
    const supplier = { id: 'supplier-1', name: 'Acme' };
    const entries = {
        findAll: vi.fn(async () => [entry]),
        findOne: vi.fn(async () => entry),
        create: vi.fn(async () => entry),
        remove: vi.fn(async () => undefined),
    };
    const suppliers = {
        findAll: vi.fn(async () => [supplier]),
        findOne: vi.fn(async () => supplier),
        create: vi.fn(async () => supplier),
        update: vi.fn(async () => supplier),
        remove: vi.fn(async () => undefined),
    };
    let stockController: StockEntriesController;
    let suppliersController: SuppliersController;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [StockEntriesController, SuppliersController],
            providers: [
                { provide: StockEntriesService, useValue: entries },
                { provide: SuppliersService, useValue: suppliers },
            ],
        })
            .overrideGuard(AdminGuard)
            .useValue({ canActivate: () => true })
            .compile();

        stockController = module.get<StockEntriesController>(StockEntriesController);
        suppliersController = module.get<SuppliersController>(SuppliersController);
    });

    it('delegates stock entry routes to the service', async () => {
        const filter = { month: 11 };
        const admin = { id: 'admin-1' } as never;
        await expect(stockController.findAll(filter)).resolves.toEqual([entry]);
        await expect(stockController.findOne(entry.id)).resolves.toEqual(entry);
        await expect(stockController.create({} as never, admin)).resolves.toEqual(entry);
        await stockController.remove(entry.id);

        expect(entries.findAll).toHaveBeenCalledWith(filter);
        expect(entries.create).toHaveBeenCalledWith({}, 'admin-1');
        expect(entries.remove).toHaveBeenCalledWith(entry.id);
    });

    it('delegates supplier routes to the service', async () => {
        await expect(suppliersController.findAll()).resolves.toEqual([supplier]);
        await expect(suppliersController.findOne(supplier.id)).resolves.toEqual(supplier);
        await expect(suppliersController.create({} as never)).resolves.toEqual(supplier);
        await expect(suppliersController.update(supplier.id, {} as never)).resolves.toEqual(supplier);
        await suppliersController.remove(supplier.id);

        expect(suppliers.remove).toHaveBeenCalledWith(supplier.id);
    });

    it('restricts entry creation to managers and deletion to the system admin', () => {
        expect(Reflect.getMetadata(ADMIN_ROLES_KEY, stockController.create)).toEqual([
            AdminRole.SYSTEM,
            AdminRole.MANAGER,
        ]);
        expect(Reflect.getMetadata(ADMIN_ROLES_KEY, stockController.remove)).toEqual([
            AdminRole.SYSTEM,
        ]);
        expect(Reflect.getMetadata(ADMIN_ROLES_KEY, stockController.findAll)).toBeUndefined();
    });

    it('restricts supplier writes to system and manager', () => {
        for (const handler of [suppliersController.create, suppliersController.update, suppliersController.remove]) {
            expect(Reflect.getMetadata(ADMIN_ROLES_KEY, handler)).toEqual([
                AdminRole.SYSTEM,
                AdminRole.MANAGER,
            ]);
        }
        expect(Reflect.getMetadata(ADMIN_ROLES_KEY, suppliersController.findAll)).toBeUndefined();
    });
});
