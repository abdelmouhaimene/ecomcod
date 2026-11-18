import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
    PublicStockEntry,
    PublicStockEntryItem,
    StockEntryFilter,
    StockEntryPayload,
} from '@repo/types';
import {
    DataSource,
    In,
    type EntityManager,
    type Repository,
    type SelectQueryBuilder,
} from 'typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { StockEntryItem } from './entities/stock-entry-item.entity.js';
import { StockEntry } from './entities/stock-entry.entity.js';
import { Supplier } from './entities/supplier.entity.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicStockEntryWithDates = PublicStockEntry<Date>;

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
        @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
        @InjectRepository(Admin) private readonly admins: Repository<Admin>,
        private readonly dataSource: DataSource,
    ) { }

    toPublic(entry: StockEntry): PublicStockEntryWithDates {
        const items: PublicStockEntryItem<Date>[] = [...(entry.items ?? [])]
            .sort((a, b) =>
                a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
            )
            .map((item) => ({
                id: item.id,
                productId: item.productId,
                productRef: item.product?.ref ?? '',
                productName: item.product?.name ?? '',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
                createdAt: item.createdAt,
            }));

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
            .leftJoinAndSelect('item.product', 'product');
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

    async create(dto: StockEntryPayload, adminId: string): Promise<PublicStockEntryWithDates> {
        const supplier = await this.suppliers.findOneBy({ id: dto.supplierId });
        if (!supplier) throw new NotFoundException('Supplier not found');

        const admin = await this.admins.findOneBy({ id: adminId });
        if (!admin) throw new NotFoundException('Admin not found');

        const productIds = [...new Set(dto.items.map((item) => item.productId))].sort();
        const products = await this.dataSource.getRepository(Product).findBy({ id: In(productIds) });
        if (products.length !== productIds.length) {
            throw new NotFoundException('One or more products were not found.');
        }

        const lines = dto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: roundMoney(item.unitPrice),
            lineTotal: roundMoney(item.quantity * item.unitPrice),
        }));
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
            await manager.save(
                StockEntryItem,
                lines.map((line) =>
                    manager.create(StockEntryItem, { ...line, entryId: entry.id }),
                ),
            );
            await this.recomputeStock(manager, productIds);
            return entry.id;
        });

        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const entry = await manager.findOne(StockEntry, {
                where: { id },
                relations: { items: true },
            });
            if (!entry) throw new NotFoundException('Stock entry not found');

            const productIds = [...new Set((entry.items ?? []).map((item) => item.productId))].sort();
            await manager.delete(StockEntryItem, { entryId: id });
            await manager.delete(StockEntry, { id });
            await this.recomputeStock(manager, productIds);
        });
    }

    /**
     * Rebuilds quantity and PMP from every remaining entry, ordered by the
     * document date and then its creation. Deleting an old entry therefore
     * restores stock exactly as if that document had never existed.
     */
    private async recomputeStock(manager: EntityManager, productIds: string[]): Promise<void> {
        const ids = [...productIds].sort();
        if (ids.length === 0) return;

        // Lock in id order so concurrent entries never deadlock each other.
        const products = await manager.find(Product, {
            where: { id: In(ids) },
            order: { id: 'ASC' },
            lock: { mode: 'pessimistic_write' },
        });

        const rows = await manager
            .createQueryBuilder(StockEntryItem, 'item')
            .innerJoin('item.entry', 'entry')
            .select(['item.productId', 'item.quantity', 'item.unitPrice'])
            .where('item.productId IN (:...ids)', { ids })
            .orderBy('entry.date', 'ASC')
            .addOrderBy('entry.createdAt', 'ASC')
            .addOrderBy('entry.id', 'ASC')
            .addOrderBy('item.id', 'ASC')
            .getMany();

        const state = new Map(ids.map((productId) => [productId, { quantity: 0, PMP: 0 }]));
        for (const row of rows) {
            const current = state.get(row.productId);
            if (!current) continue;
            current.quantity += row.quantity;
            current.PMP =
                current.quantity > 0
                    ? roundMoney(
                          current.PMP +
                              ((row.unitPrice - current.PMP) * row.quantity) / current.quantity,
                      )
                    : 0;
        }

        for (const product of products) {
            const next = state.get(product.id);
            if (!next) continue;
            if (product.quantity !== next.quantity || product.PMP !== next.PMP) {
                await manager.update(Product, product.id, {
                    quantity: next.quantity,
                    PMP: next.PMP,
                });
            }
        }
    }
}
