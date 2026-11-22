import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service.js';
import { LockService } from '../cache/lock.service.js';
import { Offer } from '../offers/entities/offer.entity.js';
import { ProductSku } from '../products/entities/product-sku.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { StockMovement } from '../stock/entities/stock-movement.entity.js';
import { OrderDto } from './dto/order.dto.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from './entities/order.entity.js';
import { OrdersService } from './orders.service.js';

const dates = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const skuA = {
    id: 'sku-a', productId: 'p1', sku: 'A', label: 'A', stockQuantity: 10, PMP: 5,
    isActive: true, product: { id: 'p1', name: 'Product A', price: 20 },
};
const skuA2 = {
    id: 'sku-a2', productId: 'p1', sku: 'A2', label: 'A2', stockQuantity: 10, PMP: 6,
    isActive: true, product: { id: 'p1', name: 'Product A', price: 20 },
};
const skuB = {
    id: 'sku-b', productId: 'p2', sku: 'B', label: 'B', stockQuantity: 10, PMP: 8,
    isActive: true, product: { id: 'p2', name: 'Product B', price: 30 },
};
const products = [
    { id: 'p1', quantity: 10, PMP: 5, realSolds: 0 },
    { id: 'p2', quantity: 10, PMP: 8, realSolds: 0 },
];

const freeOffer = {
    id: 'offer-free', name: 'Buy 2 get 1', type: 'SINGLE_PRODUCT', isActive: true,
    startsAt: null, endsAt: null, packPrice: null, packItems: [],
    singleRule: {
        id: 'rule-free', offerId: 'offer-free', productId: 'p1',
        mode: 'BUY_X_GET_Y_FREE', buyQuantity: 2, freeQuantity: 1, ...dates,
    },
    ...dates,
};
const shippingOffer = {
    id: 'offer-shipping', name: 'Free shipping', type: 'SINGLE_PRODUCT', isActive: true,
    startsAt: null, endsAt: null, packPrice: null, packItems: [],
    singleRule: {
        id: 'rule-shipping', offerId: 'offer-shipping', productId: 'p1',
        mode: 'BUY_X_GET_FREE_SHIPPING', buyQuantity: 1, freeQuantity: null, ...dates,
    },
    ...dates,
};
const packOffer = {
    id: 'offer-pack', name: 'Bundle', type: 'PACK', isActive: true,
    startsAt: null, endsAt: null, packPrice: 40, singleRule: null,
    packItems: [
        { id: 'pi-1', offerId: 'offer-pack', productId: 'p1', quantity: 1, ...dates },
        { id: 'pi-2', offerId: 'offer-pack', productId: 'p2', quantity: 1, ...dates },
    ],
    ...dates,
};

const singleSelection = [{ productId: 'p1', skuId: 'sku-a' }];
const packSelections = [
    { productId: 'p1', skuId: 'sku-a' },
    { productId: 'p2', skuId: 'sku-b' },
];

function dto(overrides: Partial<OrderDto> = {}): OrderDto {
    return {
        source: 'WEB',
        items: [{ skuId: 'sku-a', quantity: 2 }],
        ...overrides,
    } as OrderDto;
}

function idsIn(options?: { where?: { id?: { value?: string[] } } }): string[] {
    return options?.where?.id?.value ?? [];
}

describe('OrdersService', () => {
    let service: OrdersService;
    let repo: Record<string, ReturnType<typeof vi.fn>>;
    let offersRepo: { find: ReturnType<typeof vi.fn> };
    let skuRepo: { find: ReturnType<typeof vi.fn> };
    let manager: Record<string, ReturnType<typeof vi.fn>>;
    let invalidate: ReturnType<typeof vi.fn>;
    let release: ReturnType<typeof vi.fn>;
    let acquire: ReturnType<typeof vi.fn>;
    let savedItems: Array<Record<string, unknown>>;
    let savedOrder: Record<string, unknown>;

    beforeEach(async () => {
        invalidate = vi.fn(async () => undefined);
        release = vi.fn(async () => undefined);
        acquire = vi.fn(async () => ({ release }));
        savedItems = [];
        savedOrder = {};
        offersRepo = {
            find: vi.fn(async (options?: { where?: { id?: { value?: string[] } } }) => {
                const ids = idsIn(options);
                return [freeOffer, shippingOffer, packOffer].filter((offer) => ids.includes(offer.id));
            }),
        };
        skuRepo = {
            find: vi.fn(async (options?: { where?: { id?: { value?: string[] } } }) => {
                const ids = idsIn(options);
                return [skuA, skuA2, skuB]
                    .filter((sku) => ids.includes(sku.id))
                    .map((sku) => ({ ...sku }));
            }),
        };
        manager = {
            create: vi.fn((_target: unknown, value: unknown) => value),
            save: vi.fn(async (
                target: { name?: string },
                value: Record<string, unknown> | Array<Record<string, unknown>>,
            ) => {
                if (target?.name === 'Order' && !Array.isArray(value)) savedOrder = value;
                if (target?.name === 'OrderItem') {
                    const rows = Array.isArray(value) ? value : [value];
                    savedItems.push(...rows.map((row, index) => ({
                        ...row,
                        id: row.id ?? `item-${savedItems.length + index}`,
                        ...dates,
                    })));
                }
                return Array.isArray(value)
                    ? value
                    : { ...value, id: value.id ?? `saved-${target?.name}` };
            }),
            find: vi.fn(async (target: { name?: string }, options?: { where?: { isActive?: boolean } }) => {
                if (target?.name === 'Product') {
                    return products.map((product) => ({ ...product }));
                }
                if (target?.name === 'ProductSku') {
                    const source = [skuA, skuA2, skuB].map((sku) => ({ ...sku }));
                    return options?.where?.isActive === true ? source : source;
                }
                return [];
            }),
            update: vi.fn(async () => ({ affected: 1 })),
        };
        repo = {
            find: vi.fn(async () => []),
            findOne: vi.fn(async () => ({
                id: 'order-1',
                orderNumber: 'ORD-TEST',
                source: 'WEB',
                status: 'COMPLETED',
                customerName: null,
                customerEmail: null,
                notes: null,
                subtotal: 40,
                discount: 0,
                shippingCost: 0,
                taxAmount: 0,
                total: 40,
                freeShipping: false,
                ...savedOrder,
                items: savedItems,
                ...dates,
            })),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrdersService,
                { provide: getRepositoryToken(Order), useValue: repo },
                { provide: getRepositoryToken(OrderItem), useValue: {} },
                { provide: getRepositoryToken(Offer), useValue: offersRepo },
                { provide: getRepositoryToken(ProductSku), useValue: skuRepo },
                { provide: getRepositoryToken(Product), useValue: {} },
                { provide: getRepositoryToken(StockMovement), useValue: {} },
                {
                    provide: CacheService,
                    useValue: { invalidate, getOrSet: vi.fn() },
                },
                { provide: LockService, useValue: { acquire } },
                {
                    provide: DataSource,
                    useValue: {
                        transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(manager)),
                    },
                },
            ],
        }).compile();
        service = module.get<OrdersService>(OrdersService);
    });

    it('prices from the product price, deducts stock and records SALE movements', async () => {
        const result = await service.create(dto({ baseShippingCost: 5, taxAmount: 1 }));

        expect(savedOrder).toMatchObject({ subtotal: 40, discount: 0, shippingCost: 5, total: 46 });
        expect(savedItems).toMatchObject([{ skuId: 'sku-a', quantity: 2, unitPrice: 20, kind: 'REGULAR' }]);
        expect(manager.save).toHaveBeenCalledWith(
            StockMovement,
            expect.arrayContaining([
                expect.objectContaining({ sourceType: 'SALE', skuId: 'sku-a', quantity: -2 }),
            ]),
        );
        expect(manager.update).toHaveBeenCalledWith(
            ProductSku, 'sku-a', expect.objectContaining({ stockQuantity: 8 }),
        );
        expect(manager.update).toHaveBeenCalledWith(
            Product, 'p1', expect.objectContaining({ realSolds: 2 }),
        );
        expect(invalidate).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
    });

    it('acquires and releases fail-open checkout locks for every SKU', async () => {
        await service.create(dto({ items: [
            { skuId: 'sku-a', quantity: 1 },
            { skuId: 'sku-b', quantity: 1 },
        ] }));

        expect(acquire).toHaveBeenCalledWith(
            expect.stringContaining('sku-a'), 15,
        );
        expect(acquire).toHaveBeenCalledWith(
            expect.stringContaining('sku-b'), 15,
        );
        expect(release).toHaveBeenCalledTimes(2);
    });

    it('still completes when Redis locking is unavailable', async () => {
        acquire.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

        await expect(service.create(dto())).resolves.toMatchObject({ status: 'COMPLETED' });
        expect(release).not.toHaveBeenCalled();
    });

    it('rejects an order that exceeds locked stock', async () => {
        manager.find.mockImplementationOnce(async () => [{ ...skuA, stockQuantity: 1 }]);

        await expect(service.create(dto({ items: [{ skuId: 'sku-a', quantity: 3 }] })))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(manager.save).not.toHaveBeenCalled();
    });

    it('adds free units and their required stock for BUY_X_GET_Y_FREE', async () => {
        await service.create(dto({
            items: [{ skuId: 'sku-a', quantity: 2 }],
            offers: [{ offerId: 'offer-free', times: 1, selections: singleSelection }],
        }));

        expect(savedItems.map((item) => item.kind)).toEqual(['REGULAR', 'SINGLE_FREE']);
        expect(savedOrder).toMatchObject({ subtotal: 40, discount: 20, total: 20 });
        expect(manager.save).toHaveBeenCalledWith(
            StockMovement,
            expect.arrayContaining([
                expect.objectContaining({ skuId: 'sku-a', quantity: -3 }),
            ]),
        );
    });

    it('rejects a single-product offer without enough qualifying cart units', async () => {
        await expect(service.create(dto({
            items: [{ skuId: 'sku-a', quantity: 1 }],
            offers: [{ offerId: 'offer-free', times: 1, selections: singleSelection }],
        }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('gives free units of the variant selected by the client', async () => {
        await service.create(dto({
            items: [{ skuId: 'sku-a2', quantity: 2 }],
            offers: [{ offerId: 'offer-free', times: 1, selections: [{ productId: 'p1', skuId: 'sku-a2' }] }],
        }));

        expect(savedItems).toMatchObject([
            { skuId: 'sku-a2', quantity: 2, kind: 'REGULAR' },
            { skuId: 'sku-a2', quantity: 1, kind: 'SINGLE_FREE' },
        ]);
        expect(manager.save).toHaveBeenCalledWith(
            StockMovement,
            expect.arrayContaining([
                expect.objectContaining({ skuId: 'sku-a2', quantity: -3 }),
            ]),
        );
    });

    it('rejects an applied offer with no variant selections', async () => {
        await expect(service.create(dto({
            items: [{ skuId: 'sku-a', quantity: 2 }],
            offers: [{ offerId: 'offer-free', times: 1, selections: [] }],
        }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a selection for a product that is not in the offer', async () => {
        await expect(service.create(dto({
            items: [],
            offers: [{
                offerId: 'offer-pack', times: 1,
                selections: [{ productId: 'p1', skuId: 'sku-a' }],
            }],
        }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a selected variant that belongs to another product', async () => {
        await expect(service.create(dto({
            items: [],
            offers: [{
                offerId: 'offer-pack', times: 1,
                selections: [
                    { productId: 'p1', skuId: 'sku-b' },
                    { productId: 'p2', skuId: 'sku-b' },
                ],
            }],
        }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('makes shipping free without changing product prices', async () => {
        await service.create(dto({
            items: [{ skuId: 'sku-a', quantity: 1 }],
            offers: [{ offerId: 'offer-shipping', times: 1, selections: singleSelection }],
            baseShippingCost: 7,
        }));

        expect(savedOrder).toMatchObject({
            subtotal: 20, discount: 0, shippingCost: 0, total: 20, freeShipping: true,
        });
    });

    it('applies a pack price and sums required quantities across its SKUs', async () => {
        await service.create(dto({
            items: [],
            offers: [{ offerId: 'offer-pack', times: 2, selections: packSelections }],
        }));

        expect(savedOrder).toMatchObject({ subtotal: 100, discount: 20, total: 80 });
        expect(savedItems).toMatchObject([
            { skuId: 'sku-a', quantity: 2, kind: 'PACK' },
            { skuId: 'sku-b', quantity: 2, kind: 'PACK' },
        ]);
        const movementCall = manager.save.mock.calls
            .find((call) => call[0]?.name === 'StockMovement');
        expect(movementCall?.[1]).toEqual(expect.arrayContaining([
            expect.objectContaining({ skuId: 'sku-a', quantity: -2 }),
            expect.objectContaining({ skuId: 'sku-b', quantity: -2 }),
        ]));
    });

    it('rejects a pack priced above the current base item value', async () => {
        const expensivePack = {
            ...packOffer,
            packPrice: 60,
            packItems: [{ ...packOffer.packItems[0] }],
        };
        offersRepo.find.mockResolvedValueOnce([expensivePack]);

        await expect(service.create(dto({
            items: [],
            offers: [{ offerId: 'offer-pack', times: 1, selections: packSelections }],
        }))).rejects.toBeInstanceOf(BadRequestException);
    });
});
