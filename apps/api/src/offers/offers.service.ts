import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_PREFIXES } from '../cache/cache-keys.js';
import { CacheService } from '../cache/cache.service.js';
import type {
    OfferPayload,
    PublicOffer,
    PublicOfferPackItem,
    PublicOfferSingleRule,
} from '@repo/types';
import { DataSource, In, type EntityManager, type Repository } from 'typeorm';
import { OfferDto } from './dto/offer.dto.js';
import { OfferPackItem } from './entities/offer-pack-item.entity.js';
import { OfferSingleRule } from './entities/offer-single-rule.entity.js';
import { Offer } from './entities/offer.entity.js';
import { Product } from '../products/entities/product.entity.js';

export type PublicOfferWithDates = PublicOffer<Date>;

function isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === '23505';
}

@Injectable()
export class OffersService {
    constructor(
        @InjectRepository(Offer) private readonly repo: Repository<Offer>,
        @InjectRepository(OfferSingleRule) private readonly rules: Repository<OfferSingleRule>,
        @InjectRepository(OfferPackItem) private readonly packItems: Repository<OfferPackItem>,
        @InjectRepository(Product) private readonly products: Repository<Product>,
        private readonly dataSource: DataSource,
        private readonly cache: CacheService,
    ) { }

    toPublic(offer: Offer): PublicOfferWithDates {
        const singleRule: PublicOfferSingleRule<Date> | null = offer.singleRule
            ? {
                  id: offer.singleRule.id,
                  offerId: offer.singleRule.offerId,
                  productId: offer.singleRule.productId,
                  mode: offer.singleRule.mode,
                  buyQuantity: offer.singleRule.buyQuantity,
                  freeQuantity: offer.singleRule.freeQuantity ?? null,
                  createdAt: offer.singleRule.createdAt,
              }
            : null;
        const packItems: PublicOfferPackItem<Date>[] = (offer.packItems ?? [])
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
            .map((item) => ({
                id: item.id,
                offerId: item.offerId,
                productId: item.productId,
                quantity: item.quantity,
                createdAt: item.createdAt,
            }));

        return {
            id: offer.id,
            name: offer.name,
            type: offer.type,
            isActive: offer.isActive,
            startsAt: offer.startsAt ?? null,
            endsAt: offer.endsAt ?? null,
            freeShipping: offer.singleRule?.mode === 'BUY_X_GET_FREE_SHIPPING',
            packPrice: offer.packPrice ?? null,
            singleRule,
            packItems,
            createdAt: offer.createdAt,
            updatedAt: offer.updatedAt,
        };
    }

    async findAll(): Promise<PublicOfferWithDates[]> {
        const offers = await this.repo.find({
            relations: { singleRule: true, packItems: true },
            order: { createdAt: 'DESC' },
        });
        return offers.map((offer) => this.toPublic(offer));
    }

    async findActive(): Promise<PublicOfferWithDates[]> {
        // Deliberately uncached: an offer must disappear from the storefront
        // the moment its window closes, without waiting for a TTL to expire.
        const now = new Date();
        const offers = await this.repo
            .createQueryBuilder('offer')
            .leftJoinAndSelect('offer.singleRule', 'singleRule')
            .leftJoinAndSelect('offer.packItems', 'packItem')
            .where('offer.isActive = :active', { active: true })
            .andWhere('(offer.startsAt IS NULL OR offer.startsAt <= :now)', { now })
            .andWhere('(offer.endsAt IS NULL OR offer.endsAt >= :now)', { now })
            .orderBy('offer.createdAt', 'DESC')
            .getMany();
        return offers.map((offer) => this.toPublic(offer));
    }

    async findOne(id: string): Promise<PublicOfferWithDates> {
        const offer = await this.repo.findOne({
            where: { id },
            relations: { singleRule: true, packItems: true },
        });
        if (!offer) throw new NotFoundException('Offer not found');
        return this.toPublic(offer);
    }

    async create(dto: OfferDto): Promise<PublicOfferWithDates> {
        await this.assertProducts(dto);
        try {
            const id = await this.dataSource.transaction(async (manager) => {
                const offer = await manager.save(
                    Offer,
                    manager.create(Offer, this.scalars(dto)),
                );
                await this.saveChildren(manager, offer.id, dto);
                return offer.id;
            });
            await this.invalidate();
            return await this.findOne(id);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictException('An offer with this name already exists.');
            }
            throw error;
        }
    }

    async update(id: string, dto: OfferDto): Promise<PublicOfferWithDates> {
        const offer = await this.repo.findOneBy({ id });
        if (!offer) throw new NotFoundException('Offer not found');
        await this.assertProducts(dto);

        try {
            await this.dataSource.transaction(async (manager) => {
                await manager.update(Offer, id, this.scalars(dto));
                await manager.delete(OfferSingleRule, { offerId: id });
                await manager.delete(OfferPackItem, { offerId: id });
                await this.saveChildren(manager, id, dto);
            });
            await this.invalidate();
            return await this.findOne(id);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictException('An offer with this name already exists.');
            }
            throw error;
        }
    }

    async remove(id: string): Promise<void> {
        const offer = await this.repo.findOneBy({ id });
        if (!offer) throw new NotFoundException('Offer not found');
        await this.repo.delete({ id });
        await this.invalidate();
    }

    private scalars(dto: OfferDto): Partial<Offer> {
        return {
            name: dto.name.trim(),
            type: dto.type,
            isActive: dto.isActive,
            startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
            endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
            packPrice: dto.type === 'PACK' ? (dto.packPrice ?? null) : null,
        };
    }

    private async saveChildren(manager: EntityManager, offerId: string, dto: OfferDto): Promise<void> {
        if (dto.type === 'SINGLE_PRODUCT' && dto.singleRule) {
            await manager.save(
                OfferSingleRule,
                manager.create(OfferSingleRule, {
                    offerId,
                    productId: dto.singleRule.productId,
                    mode: dto.singleRule.mode as 'BUY_X_GET_Y_FREE' | 'BUY_X_GET_FREE_SHIPPING',
                    buyQuantity: dto.singleRule.buyQuantity,
                    freeQuantity: dto.singleRule.mode === 'BUY_X_GET_Y_FREE'
                        ? (dto.singleRule.freeQuantity ?? null)
                        : null,
                }),
            );
            return;
        }

        for (const item of dto.packItems ?? []) {
            await manager.save(
                OfferPackItem,
                manager.create(OfferPackItem, {
                    offerId,
                    productId: item.productId,
                    quantity: item.quantity,
                }),
            );
        }
    }

    /** Offers reference products only; the client picks SKUs when applying them. */
    private async assertProducts(dto: OfferDto): Promise<void> {
        const productIds: string[] = [];
        if (dto.type === 'SINGLE_PRODUCT' && dto.singleRule) {
            productIds.push(dto.singleRule.productId);
        }
        if (dto.type === 'PACK') {
            productIds.push(...(dto.packItems ?? []).map((item) => item.productId));
            if (new Set(productIds).size !== productIds.length) {
                throw new BadRequestException('Each product can appear only once in a pack offer.');
            }
        }
        if (productIds.length === 0) return;

        const uniqueIds = [...new Set(productIds)];
        const products = await this.products.find({ where: { id: In(uniqueIds) } });
        if (products.length !== uniqueIds.length) {
            throw new NotFoundException('One or more products were not found.');
        }
    }

    private async invalidate(): Promise<void> {
        await this.cache.invalidate(CACHE_PREFIXES.offersActive, CACHE_PREFIXES.catalog);
    }
}

// Keeps the shared contract import used for static typing in one place.
export type OfferPayloadContract = OfferPayload;
