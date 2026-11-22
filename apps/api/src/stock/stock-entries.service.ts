import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
    PublicStockAvailability,
    PublicStockEntry,
    PublicStockEntryCombination,
    PublicStockEntryItem,
    StockEntryFilter,
    StockEntryItemPayload,
    StockEntryPayload,
} from '@repo/types';
import {
    CACHE_PREFIXES,
    productKey,
    skuKey,
} from '../cache/cache-keys.js';
import { CacheService } from '../cache/cache.service.js';
import {
    DataSource,
    In,
    type EntityManager,
    type Repository,
    type SelectQueryBuilder,
} from 'typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { ProductSku } from '../products/entities/product-sku.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { StockEntryCombination } from './entities/stock-entry-combination.entity.js';
import { StockEntryItem } from './entities/stock-entry-item.entity.js';
import { StockEntry } from './entities/stock-entry.entity.js';
import {
    StockMovement,
    type StockMovementSource,
} from './entities/stock-movement.entity.js';
import { Supplier } from './entities/supplier.entity.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicStockEntryWithDates = PublicStockEntry<Date>;
export type PublicStockAvailabilityWithDates = PublicStockAvailability<Date>;

type PreparedItem = StockEntryItemPayload & {
    buyingPrice: number;
    totalQuantity: number;
    lineTotal: number;
};

const roundMoney = (value: number): number =>
    Math.round((value + Number.EPSILON) * 100) / 100;

const pad = (value: number): string => String(value).padStart(2, '0');

/** Postgres `date` values arrive as `YYYY-MM-DD` strings; keep that on the wire. */
function wireDate(value: string | Date): string {
    return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

@Injectable()
export class StockEntriesService {
    constructor(
        @InjectRepository(StockEntry) private readonly repo: Repository<StockEntry>,
        @InjectRepository(StockEntryItem) private readonly items: Repository<StockEntryItem>,
        @InjectRepository(StockMovement) private readonly movements: Repository<StockMovement>,
        @InjectRepository(ProductSku) private readonly skus: Repository<ProductSku>,
        @InjectRepository(Product) private readonly products: Repository<Product>,
        @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
        @InjectRepository(Admin) private readonly admins: Repository<Admin>,
        private readonly dataSource: DataSource,
        private readonly cache: CacheService,
    ) { }

    toPublic(entry: StockEntry): PublicStockEntryWithDates {
        const items: PublicStockEntryItem<Date>[] = [...(entry.items ?? [])]
            .sort((a, b) =>
                a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
            )
            .map((item) => {
                const combinations: PublicStockEntryCombination<Date>[] = [...(item.combinations ?? [])]
                    .sort((a, b) =>
                        a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
                    )
                    .map((combination) => ({
                        id: combination.id,
                        skuId: combination.skuId,
                        sku: combination.sku?.sku ?? '',
                        skuLabel: combination.sku?.label ?? '',
                        quantity: combination.quantity,
                        createdAt: combination.createdAt,
                    }));
                return {
                    id: item.id,
                    productId: item.productId,
                    productRef: item.product?.ref ?? '',
                    productName: item.product?.name ?? '',
                    buyingPrice: item.buyingPrice,
                    totalQuantity: item.totalQuantity,
                    lineTotal: item.lineTotal,
                    combinations,
                    createdAt: item.createdAt,
                };
            });

        return {
            id: entry.id,
            date: wireDate(entry.date),
            supplierId: entry.supplierId,
            supplierName: entry.supplier?.name ?? '',
            adminId: entry.adminId,
            adminUsername: entry.admin?.username ?? '',
            total: entry.total,
            items,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        };
    }

    private query(): SelectQueryBuilder<StockEntry> {
        return this.repo
            .createQueryBuilder('entry')
            .leftJoinAndSelect('entry.supplier', 'supplier')
            .leftJoinAndSelect('entry.admin', 'admin')
            .leftJoinAndSelect('entry.items', 'item')
            .leftJoinAndSelect('item.product', 'product')
            .leftJoinAndSelect('item.combinations', 'combination')
            .leftJoinAndSelect('combination.sku', 'combinationSku');
    }

    async findAll(filter: StockEntryFilter = {}): Promise<PublicStockEntryWithDates[]> {
        const query = this.query();

        const year = filter.year ?? (filter.month ? new Date().getUTCFullYear() : undefined);
        if (year !== undefined) {
            const month = filter.month;
            const startDate = month ? `${year}-${pad(month)}-01` : `${year}-01-01`;
            const endDate = month
                ? month === 12
                    ? `${year + 1}-01-01`
                    : `${year}-${pad(month + 1)}-01`
                : `${year + 1}-01-01`;
            query.andWhere('entry.date >= :startDate AND entry.date < :endDate', {
                startDate,
                endDate,
            });
        }
        if (filter.productId) {
            query.andWhere(
                `EXISTS (
                    SELECT 1 FROM "stock_entry_items" AS "filterItem"
                    WHERE "filterItem"."entryId" = "entry"."id"
                      AND "filterItem"."productId" = :productId
                )`,
                { productId: filter.productId },
            );
        }
        if (filter.skuId) {
            query.andWhere('combination.skuId = :skuId', { skuId: filter.skuId });
        }
        if (filter.supplierId) {
            query.andWhere('entry.supplierId = :supplierId', { supplierId: filter.supplierId });
        }

        query.orderBy('entry.date', 'DESC')
            .addOrderBy('entry.createdAt', 'DESC')
            .addOrderBy('entry.id', 'DESC');

        const entries = await query.getMany();
        return entries.map((entry) => this.toPublic(entry));
    }

    async findOne(id: string): Promise<PublicStockEntryWithDates> {
        const entry = await this.query().where('entry.id = :id', { id }).getOne();
        if (!entry) throw new NotFoundException('Stock entry not found');
        return this.toPublic(entry);
    }

    /** Read-only availability snapshot used by CMS, POS and the storefront. */
    async availability(): Promise<PublicStockAvailabilityWithDates[]> {
        const load = async (): Promise<PublicStockAvailabilityWithDates[]> => {
            const rows = await this.skus.find({
                where: { isActive: true },
                relations: { product: true },
                order: { label: 'ASC' },
            });
            return rows.map((sku) => ({
                skuId: sku.id,
                productId: sku.productId,
                sku: sku.sku,
                label: sku.label,
                productRef: sku.product?.ref ?? '',
                productName: sku.product?.name ?? '',
                stockQuantity: sku.stockQuantity,
                updatedAt: sku.updatedAt,
            }));
        };
        return this.cache.getOrSet(CACHE_PREFIXES.stockAvailability, 15, load);
    }

    async create(dto: StockEntryPayload, adminId: string): Promise<PublicStockEntryWithDates> {
        const supplier = await this.suppliers.findOneBy({ id: dto.supplierId });
        if (!supplier) throw new NotFoundException('Supplier not found');

        const admin = await this.admins.findOneBy({ id: adminId });
        if (!admin) throw new NotFoundException('Admin not found');

        const lines = this.prepareItems(dto.items);
        const productIds = [...new Set(lines.map((line) => line.productId))].sort();
        const skuIds = [...new Set(lines.flatMap((line) =>
            line.combinations.map((combination) => combination.skuId),
        ))].sort();

        const [products, skus, activeSkus] = await Promise.all([
            this.products.find({ where: { id: In(productIds) } }),
            this.skus.find({ where: { id: In(skuIds) } }),
            this.skus.find({ where: { productId: In(productIds), isActive: true } }),
        ]);
        if (products.length !== productIds.length) {
            throw new NotFoundException('One or more products were not found.');
        }
        if (skus.length !== skuIds.length) {
            throw new NotFoundException('One or more SKUs were not found.');
        }
        if (skus.some((sku) => !sku.isActive)) {
            throw new BadRequestException('Inactive SKUs cannot receive stock.');
        }

        const skuById = new Map(skus.map((sku) => [sku.id, sku]));
        for (const line of lines) {
            const expected = new Set(
                activeSkus.filter((sku) => sku.productId === line.productId)
                    .map((sku) => sku.id),
            );
            const received = line.combinations.map((combination) => combination.skuId);
            if (received.some((skuId) => skuById.get(skuId)?.productId !== line.productId)) {
                throw new BadRequestException('A combination does not belong to its product.');
            }
            if (expected.size !== received.length || received.some((skuId) => !expected.has(skuId))) {
                throw new BadRequestException('All active combinations of a product must be listed.');
            }
        }

        const total = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
        const id = await this.dataSource.transaction(async (manager) => {
            const entry = await manager.save(
                StockEntry,
                manager.create(StockEntry, {
                    date: dto.date,
                    supplierId: dto.supplierId,
                    adminId,
                    total,
                }),
            );

            for (const line of lines) {
                const entryItem = await manager.save(
                    StockEntryItem,
                    manager.create(StockEntryItem, {
                        entryId: entry.id,
                        productId: line.productId,
                        buyingPrice: line.buyingPrice,
                        totalQuantity: line.totalQuantity,
                        lineTotal: line.lineTotal,
                    }),
                );
                await manager.save(
                    StockEntryCombination,
                    line.combinations.map((combination) =>
                        manager.create(StockEntryCombination, {
                            entryItemId: entryItem.id,
                            skuId: combination.skuId,
                            quantity: combination.quantity,
                        }),
                    ),
                );
            }

            const movements = lines.flatMap((line) =>
                line.combinations
                    .filter((combination) => combination.quantity > 0)
                    .map((combination) =>
                        manager.create(StockMovement, {
                            skuId: combination.skuId,
                            productId: line.productId,
                            sourceType: 'ENTRY' satisfies StockMovementSource,
                            stockEntryId: entry.id,
                            orderId: null,
                            quantity: combination.quantity,
                            unitPrice: line.buyingPrice,
                        }),
                    ),
            );
            if (movements.length > 0) {
                await manager.save(StockMovement, movements);
            }
            await this.recomputeStock(manager, skuIds, productIds);
            return entry.id;
        });

        await this.invalidate(skuIds, productIds);
        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        const { skuIds, productIds } = await this.dataSource.transaction(async (manager) => {
            const entry = await manager.findOne(StockEntry, {
                where: { id },
                relations: { items: { combinations: true } },
            });
            if (!entry) throw new NotFoundException('Stock entry not found');

            const skuIds = [...new Set((entry.items ?? []).flatMap((item) =>
                (item.combinations ?? []).map((combination) => combination.skuId),
            ))].sort();
            const productIds = [...new Set((entry.items ?? []).map((item) => item.productId))].sort();
            const itemIds = (entry.items ?? []).map((item) => item.id);

            await manager.delete(StockMovement, { stockEntryId: id });
            if (itemIds.length > 0) {
                await manager.delete(StockEntryCombination, { entryItemId: In(itemIds) });
            }
            await manager.delete(StockEntryItem, { entryId: id });
            await manager.delete(StockEntry, { id });
            await this.recomputeStock(manager, skuIds, productIds);
            return { skuIds, productIds };
        });

        await this.invalidate(skuIds, productIds);
    }

    /** Rejects mismatched distributions even when the service is called directly. */
    private prepareItems(items: StockEntryItemPayload[]): PreparedItem[] {
        return items.map((item) => {
            const sum = item.combinations.reduce((total, combination) => total + combination.quantity, 0);
            if (sum < item.totalQuantity) {
                throw new BadRequestException(
                    `Combination quantities (${sum}) are less than totalQuantity (${item.totalQuantity}).`,
                );
            }
            if (sum > item.totalQuantity) {
                throw new BadRequestException(
                    `Combination quantities (${sum}) are greater than totalQuantity (${item.totalQuantity}).`,
                );
            }
            const buyingPrice = roundMoney(item.buyingPrice);
            return {
                ...item,
                buyingPrice,
                lineTotal: roundMoney(item.totalQuantity * buyingPrice),
            };
        });
    }

    /**
     * Rebuilds SKU stock from every remaining movement. Entries change WAP;
     * sales only reduce quantity, so historical cost is never distorted.
     */
    private async recomputeStock(
        manager: EntityManager,
        skuIds: string[],
        productIds: string[],
    ): Promise<void> {
        const ids = [...skuIds].sort();
        if (ids.length === 0) return;

        // Consistent order: SKUs first, then products, in both stock and checkout.
        const skus = await manager.find(ProductSku, {
            where: { id: In(ids) },
            order: { id: 'ASC' },
            lock: { mode: 'pessimistic_write' },
        });

        const rows = await manager
            .createQueryBuilder(StockMovement, 'movement')
            .select([
                'movement.skuId',
                'movement.sourceType',
                'movement.quantity',
                'movement.unitPrice',
            ])
            .where('movement.skuId IN (:...ids)', { ids })
            .orderBy('movement.createdAt', 'ASC')
            .addOrderBy('movement.id', 'ASC')
            .getMany();

        const state = new Map(ids.map((skuId) => [skuId, { quantity: 0, PMP: 0 }]));
        for (const row of rows) {
            const current = state.get(row.skuId);
            if (!current) continue;
            if (row.sourceType === 'ENTRY') {
                current.quantity += row.quantity;
                current.PMP =
                    current.quantity > 0
                        ? roundMoney(
                              current.PMP +
                                  ((row.unitPrice - current.PMP) * row.quantity) / current.quantity,
                          )
                        : 0;
            } else {
                current.quantity += row.quantity; // already negative
                if (current.quantity <= 0) current.PMP = 0;
            }
        }

        for (const sku of skus) {
            const next = state.get(sku.id);
            if (!next) continue;
            if (sku.stockQuantity !== next.quantity || sku.PMP !== next.PMP) {
                await manager.update(ProductSku, sku.id, {
                    stockQuantity: next.quantity,
                    PMP: next.PMP,
                });
            }
        }

        await this.recomputeProductAggregates(manager, productIds);
    }

    private async recomputeProductAggregates(
        manager: EntityManager,
        productIds: string[],
    ): Promise<void> {
        const ids = [...new Set(productIds)].sort();
        if (ids.length === 0) return;

        const products = await manager.find(Product, {
            where: { id: In(ids) },
            order: { id: 'ASC' },
            lock: { mode: 'pessimistic_write' },
        });
        const skus = await manager.find(ProductSku, {
            where: { productId: In(ids), isActive: true },
        });

        for (const product of products) {
            const productSkus = skus.filter((sku) => sku.productId === product.id);
            const quantity = productSkus.reduce((sum, sku) => sum + sku.stockQuantity, 0);
            const weighted = productSkus.reduce(
                (sum, sku) => sum + sku.PMP * sku.stockQuantity,
                0,
            );
            const PMP = quantity > 0 ? roundMoney(weighted / quantity) : 0;
            if (product.quantity !== quantity || product.PMP !== PMP) {
                await manager.update(Product, product.id, { quantity, PMP });
            }
        }
    }

    private async invalidate(skuIds: string[], productIds: string[]): Promise<void> {
        await this.cache.invalidate(
            CACHE_PREFIXES.catalog,
            CACHE_PREFIXES.families,
            CACHE_PREFIXES.offersActive,
            CACHE_PREFIXES.stockAvailability,
            ...productIds.map(productKey),
            ...skuIds.map(skuKey),
        );
    }
}
