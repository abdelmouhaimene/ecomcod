import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PublicOrder } from '@repo/types';
import { randomUUID } from 'node:crypto';
import {
    CACHE_PREFIXES,
    checkoutKey,
    productKey,
    skuKey,
} from '../cache/cache-keys.js';
import { CacheService } from '../cache/cache.service.js';
import { LockService, type RedisLock } from '../cache/lock.service.js';
import { DataSource, In, type Repository } from 'typeorm';
import { Offer } from '../offers/entities/offer.entity.js';
import { ProductSku } from '../products/entities/product-sku.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { StockMovement } from '../stock/entities/stock-movement.entity.js';
import { OrderDto } from './dto/order.dto.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from './entities/order.entity.js';

export type PublicOrderWithDates = PublicOrder<Date>;

const roundMoney = (value: number): number =>
    Math.round((value + Number.EPSILON) * 100) / 100;

interface LineDraft {
    skuId: string;
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    kind: 'REGULAR' | 'SINGLE_FREE' | 'PACK';
    offerId: string | null;
    offerName: string | null;
}

interface CheckoutPlan {
    lines: LineDraft[];
    required: Map<string, number>;
    productIds: string[];
    discount: number;
    freeShipping: boolean;
}

@Injectable()
export class OrdersService {
    constructor(
        @InjectRepository(Order) private readonly repo: Repository<Order>,
        @InjectRepository(OrderItem) private readonly items: Repository<OrderItem>,
        @InjectRepository(Offer) private readonly offers: Repository<Offer>,
        @InjectRepository(ProductSku) private readonly skus: Repository<ProductSku>,
        @InjectRepository(Product) private readonly products: Repository<Product>,
        @InjectRepository(StockMovement) private readonly movements: Repository<StockMovement>,
        private readonly dataSource: DataSource,
        private readonly cache: CacheService,
        private readonly lock: LockService,
    ) { }

    toPublic(order: Order): PublicOrderWithDates {
        return {
            id: order.id,
            orderNumber: order.orderNumber,
            source: order.source,
            status: order.status,
            customerName: order.customerName ?? null,
            customerEmail: order.customerEmail ?? null,
            notes: order.notes ?? null,
            subtotal: order.subtotal,
            discount: order.discount,
            shippingCost: order.shippingCost,
            taxAmount: order.taxAmount,
            total: order.total,
            freeShipping: order.freeShipping,
            items: [...(order.items ?? [])]
                .sort((a, b) =>
                    a.createdAt.getTime() - b.createdAt.getTime() ||
                    (a.id ?? '').localeCompare(b.id ?? ''),
                )
                .map((item) => ({
                    id: item.id,
                    skuId: item.skuId,
                    productId: item.productId,
                    sku: item.sku,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    lineTotal: item.lineTotal,
                    kind: item.kind,
                    offerId: item.offerId ?? null,
                    offerName: item.offerName ?? null,
                    createdAt: item.createdAt,
                })),
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        };
    }

    async findAll(): Promise<PublicOrderWithDates[]> {
        const orders = await this.repo.find({ relations: { items: true }, order: { createdAt: 'DESC' } });
        return orders.map((order) => this.toPublic(order));
    }

    async findOne(id: string): Promise<PublicOrderWithDates> {
        const order = await this.repo.findOne({ where: { id }, relations: { items: true } });
        if (!order) throw new NotFoundException('Order not found');
        return this.toPublic(order);
    }

    async create(dto: OrderDto): Promise<PublicOrderWithDates> {
        const plan = await this.buildPlan(dto);
        const requiredSkus = [...plan.required.entries()].sort(([a], [b]) => a.localeCompare(b));
        const skuIds = requiredSkus.map(([skuId]) => skuId);
        const productIds = [...new Set(plan.productIds)].sort();
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

        const baseShippingCost = roundMoney(dto.baseShippingCost ?? 0);
        const shippingCost = plan.freeShipping ? 0 : baseShippingCost;
        const taxAmount = roundMoney(dto.taxAmount ?? 0);
        const baseGoods = roundMoney(
            plan.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
        );
        const discount = roundMoney(Math.min(plan.discount, baseGoods));
        const total = roundMoney(baseGoods - discount + shippingCost + taxAmount);

        // Best-effort Redis guard for contending checkouts. Failure to acquire
        // never blocks a sale; PostgreSQL FOR UPDATE below is authoritative.
        const locks: RedisLock[] = [];
        for (const key of skuIds.map(checkoutKey).sort()) {
            const acquired = await this.lock.acquire(key, 15);
            if (acquired) locks.push(acquired);
        }

        try {
            const id = await this.dataSource.transaction(async (manager) => {
                const lockedSkus = await manager.find(ProductSku, {
                    where: { id: In(skuIds) },
                    order: { id: 'ASC' },
                    lock: { mode: 'pessimistic_write' },
                });
                const lockedById = new Map(lockedSkus.map((sku) => [sku.id, sku]));
                for (const [skuId, required] of requiredSkus) {
                    const sku = lockedById.get(skuId);
                    if (!sku) throw new NotFoundException('SKU not found');
                    if (!sku.isActive) {
                        throw new BadRequestException(`${sku.label} is no longer available.`);
                    }
                    if (sku.stockQuantity < required) {
                        throw new BadRequestException(
                            `Insufficient stock for ${sku.label}: required ${required}, available ${sku.stockQuantity}.`,
                        );
                    }
                }

                // Products are always locked after SKUs to avoid deadlocks.
                const lockedProducts = await manager.find(Product, {
                    where: { id: In(productIds) },
                    order: { id: 'ASC' },
                    lock: { mode: 'pessimistic_write' },
                });

                const order = await manager.save(
                    Order,
                    manager.create(Order, {
                        orderNumber,
                        source: dto.source,
                        status: 'COMPLETED',
                        customerName: dto.customerName ?? null,
                        customerEmail: dto.customerEmail ?? null,
                        notes: dto.notes ?? null,
                        subtotal: baseGoods,
                        discount,
                        shippingCost,
                        taxAmount,
                        total,
                        freeShipping: plan.freeShipping,
                    }),
                );

                const now = new Date();
                await manager.save(
                    OrderItem,
                    plan.lines.map((line) =>
                        manager.create(OrderItem, {
                            orderId: order.id,
                            skuId: line.skuId,
                            productId: line.productId,
                            sku: line.sku,
                            productName: line.productName,
                            quantity: line.quantity,
                            unitPrice: line.unitPrice,
                            lineTotal: roundMoney(line.quantity * line.unitPrice),
                            kind: line.kind,
                            offerId: line.offerId,
                            offerName: line.offerName,
                        }),
                    ),
                );

                await manager.save(
                    StockMovement,
                    requiredSkus.map(([skuId, quantity]) => {
                        const sku = lockedById.get(skuId);
                        if (!sku) throw new NotFoundException('SKU not found');
                        return manager.create(StockMovement, {
                            skuId,
                            productId: sku.productId,
                            sourceType: 'SALE' as const,
                            stockEntryId: null,
                            orderId: order.id,
                            quantity: -quantity,
                            unitPrice: sku.PMP,
                        });
                    }),
                );

                const stockAfterById = new Map<string, number>();
                for (const [skuId, quantity] of requiredSkus) {
                    const sku = lockedById.get(skuId);
                    if (!sku) throw new NotFoundException('SKU not found');
                    const stockAfter = sku.stockQuantity - quantity;
                    stockAfterById.set(skuId, stockAfter);
                    await manager.update(ProductSku, skuId, {
                        stockQuantity: stockAfter,
                        updatedAt: now,
                    });
                }

                const activeSkus = await manager.find(ProductSku, {
                    where: { productId: In(productIds), isActive: true },
                });
                const soldByProduct = new Map<string, number>();
                for (const line of plan.lines) {
                    soldByProduct.set(
                        line.productId,
                        (soldByProduct.get(line.productId) ?? 0) + line.quantity,
                    );
                }
                for (const product of lockedProducts) {
                    const productSkus = activeSkus.filter((sku) => sku.productId === product.id);
                    const stockAfter = productSkus.reduce(
                        (sum, sku) => sum + (stockAfterById.get(sku.id) ?? sku.stockQuantity),
                        0,
                    );
                    const weighted = productSkus.reduce(
                        (sum, sku) => sum + sku.PMP * (stockAfterById.get(sku.id) ?? sku.stockQuantity),
                        0,
                    );
                    const PMP = stockAfter > 0 ? roundMoney(weighted / stockAfter) : 0;
                    await manager.update(Product, product.id, {
                        quantity: stockAfter,
                        PMP,
                        realSolds: product.realSolds + (soldByProduct.get(product.id) ?? 0),
                    });
                }

                return order.id;
            });

            await this.invalidate(skuIds, productIds);
            return await this.findOne(id);
        } finally {
            for (const lock of locks.reverse()) {
                await lock.release();
            }
        }
    }

    private async buildPlan(dto: OrderDto): Promise<CheckoutPlan> {
        const appliedOffers = dto.offers ?? [];
        // Each applied offer carries the variant chosen by the client for every
        // product it contains; keyed by offer id then product id.
        const selectedSkuByOffer = new Map<string, Map<string, string>>();
        const offerIds = appliedOffers.map((offer) => offer.offerId);
        const offers = offerIds.length > 0
            ? await this.offers.find({
                  where: { id: In(offerIds), isActive: true },
                  relations: { singleRule: true, packItems: true },
              })
            : [];
        if (offers.length !== offerIds.length) {
            throw new NotFoundException('One or more offers were not found or are inactive.');
        }
        const now = new Date();
        const offerById = new Map(offers.map((offer) => [offer.id, offer]));
        const required = new Map<string, number>();
        const addRequired = (skuId: string, quantity: number): void => {
            required.set(skuId, (required.get(skuId) ?? 0) + quantity);
        };
        const lines: LineDraft[] = [];
        const productIds = new Set<string>();
        let discount = 0;
        let freeShipping = false;

        for (const item of dto.items) {
            addRequired(item.skuId, item.quantity);
        }

        for (const applied of appliedOffers) {
            const offer = offerById.get(applied.offerId);
            if (!offer) throw new NotFoundException('Offer not found');
            if (offer.startsAt && offer.startsAt > now) {
                throw new BadRequestException(`${offer.name} is not active yet.`);
            }
            if (offer.endsAt && offer.endsAt < now) {
                throw new BadRequestException(`${offer.name} has expired.`);
            }
            const times = applied.times;

            const offerProducts = offer.type === 'SINGLE_PRODUCT'
                ? (offer.singleRule ? [offer.singleRule.productId] : [])
                : [...new Set((offer.packItems ?? []).map((item) => item.productId))];
            const selected = new Map(
                applied.selections.map((selection) => [selection.productId, selection.skuId]),
            );
            if (
                selected.size !== offerProducts.length ||
                offerProducts.some((productId) => !selected.has(productId))
            ) {
                throw new BadRequestException(
                    `${offer.name} requires one variant selection for each product in the offer.`,
                );
            }
            selectedSkuByOffer.set(offer.id, selected);

            if (offer.type === 'SINGLE_PRODUCT') {
                const rule = offer.singleRule;
                if (!rule) throw new BadRequestException(`${offer.name} is missing its rule.`);
                const skuId = selected.get(rule.productId);
                if (!skuId) throw new BadRequestException(`${offer.name} is missing a variant selection.`);
                // The qualifying paid units must already be in the cart for the
                // variant chosen by the client; the offer never adds paid units.
                const paidInCart = dto.items
                    .filter((item) => item.skuId === skuId)
                    .reduce((sum, item) => sum + item.quantity, 0);
                if (paidInCart < rule.buyQuantity * times) {
                    throw new BadRequestException(
                        `${offer.name} requires ${rule.buyQuantity * times} units of the selected variant in the cart.`,
                    );
                }
                if (rule.mode === 'BUY_X_GET_Y_FREE') {
                    addRequired(skuId, (rule.freeQuantity ?? 0) * times);
                } else if (rule.mode === 'BUY_X_GET_FREE_SHIPPING') {
                    freeShipping = true;
                }
                continue;
            }

            for (const item of offer.packItems ?? []) {
                const skuId = selected.get(item.productId);
                if (!skuId) throw new BadRequestException(`${offer.name} is missing a variant selection.`);
                addRequired(skuId, item.quantity * times);
            }
        }

        const skuIds = [...required.keys()];
        const skuRows = skuIds.length > 0
            ? await this.skus.find({ where: { id: In(skuIds) }, relations: { product: true } })
            : [];
        if (skuRows.length !== skuIds.length) {
            throw new NotFoundException('One or more SKUs were not found.');
        }
        const skuById = new Map(skuRows.map((sku) => [sku.id, sku]));

        // Selections for free-shipping offers may not appear in `required`, so
        // load any remaining selected SKUs to validate the client's choices.
        const selectionPairs = appliedOffers.flatMap((applied) =>
            [...(selectedSkuByOffer.get(applied.offerId) ?? new Map())]
                .map(([productId, skuId]) => ({ productId, skuId })),
        );
        const missingSelectionIds = [...new Set(selectionPairs.map((pair) => pair.skuId))]
            .filter((skuId) => !skuById.has(skuId));
        if (missingSelectionIds.length > 0) {
            const extraSkus = await this.skus.find({
                where: { id: In(missingSelectionIds) },
                relations: { product: true },
            });
            if (extraSkus.length !== missingSelectionIds.length) {
                throw new NotFoundException('One or more selected SKUs were not found.');
            }
            for (const sku of extraSkus) skuById.set(sku.id, sku);
        }
        for (const { productId, skuId } of selectionPairs) {
            const sku = skuById.get(skuId);
            if (!sku) throw new NotFoundException('Selected SKU not found');
            if (sku.productId !== productId) {
                throw new BadRequestException('The selected variant does not belong to its offered product.');
            }
            if (!sku.isActive || sku.stockQuantity <= 0) {
                throw new BadRequestException(`${sku.label} is no longer available.`);
            }
        }

        const skuInfo = (skuId: string) => {
            const sku = skuById.get(skuId);
            if (!sku?.product) throw new NotFoundException('SKU product not found');
            if (!sku.isActive) throw new BadRequestException(`${sku.label} is no longer available.`);
            productIds.add(sku.productId);
            return {
                productId: sku.productId,
                sku: sku.sku,
                productName: sku.product.name,
                price: sku.product.price,
            };
        };

        for (const item of dto.items) {
            const info = skuInfo(item.skuId);
            lines.push({
                ...info,
                skuId: item.skuId,
                quantity: item.quantity,
                unitPrice: info.price,
                kind: 'REGULAR',
                offerId: null,
                offerName: null,
            });
        }

        for (const applied of appliedOffers) {
            const offer = offerById.get(applied.offerId);
            if (!offer) continue;
            const times = applied.times;
            if (offer.type === 'SINGLE_PRODUCT') {
                const rule = offer.singleRule;
                if (!rule) continue;
                if (rule.mode !== 'BUY_X_GET_Y_FREE') continue;
                const selectedSkuId = selectedSkuByOffer.get(offer.id)?.get(rule.productId);
                if (!selectedSkuId) continue;
                const info = skuInfo(selectedSkuId);
                const freeQuantity = (rule.freeQuantity ?? 0) * times;
                lines.push({
                    ...info,
                    skuId: selectedSkuId,
                    quantity: freeQuantity,
                    unitPrice: 0,
                    kind: 'SINGLE_FREE',
                    offerId: offer.id,
                    offerName: offer.name,
                });
                discount = roundMoney(discount + freeQuantity * info.price);
                continue;
            }

            let packBase = 0;
            for (const item of offer.packItems ?? []) {
                const selectedSkuId = selectedSkuByOffer.get(offer.id)?.get(item.productId);
                if (!selectedSkuId) continue;
                const info = skuInfo(selectedSkuId);
                const quantity = item.quantity * times;
                packBase = roundMoney(packBase + quantity * info.price);
                lines.push({
                    ...info,
                    skuId: selectedSkuId,
                    quantity,
                    unitPrice: info.price,
                    kind: 'PACK',
                    offerId: offer.id,
                    offerName: offer.name,
                });
            }
            const packPrice = roundMoney((offer.packPrice ?? 0) * times);
            if (packPrice > packBase) {
                throw new BadRequestException(
                    `${offer.name} fixed price exceeds the current product base prices.`,
                );
            }
            discount = roundMoney(discount + (packBase - packPrice));
        }

        return {
            lines,
            required,
            productIds: [...productIds],
            discount,
            freeShipping,
        };
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
