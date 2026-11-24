import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    CACHE_PREFIXES,
    CACHE_TTLS_SECONDS,
    catalogListKey,
    productKey,
    skuKey,
} from '../cache/cache-keys.js';
import { CacheService } from '../cache/cache.service.js';
import type {
    PaginatedProducts,
    PublicCategory,
    PublicFamily,
    PublicProduct,
    PublicProductSku,
    PublicProductVariant,
    VariantType,
} from '@repo/types';
import { randomUUID } from 'node:crypto';
import {
    DataSource,
    In,
    type EntityManager,
    type Repository,
} from 'typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { Family } from '../families/entities/family.entity.js';
import { FindProductsDto } from './dto/find-products.dto.js';
import { ProductDto } from './dto/product.dto.js';
import { ProductCategory } from './entities/product-category.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductSku } from './entities/product-sku.entity.js';
import {
    ProductVariant,
    SIZE_TEXT_VALUES,
    VARIANT_TYPES,
} from './entities/product-variant.entity.js';
import { ProductVariantValue } from './entities/product-variant-value.entity.js';
import { Product } from './entities/product.entity.js';
import {
    buildCombination,
    skuCode,
    valueCombinations,
    variantDimension,
    variantValue,
    variantValueIdKey,
} from './sku.utils.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicProductWithDates = PublicProduct<Date>;

const productRelations = {
    productCategories: { category: true },
    families: true,
    images: true,
    variants: { values: { image: true } },
    skus: { variantValues: true, image: true },
} as const;

type SavedVariant = ProductVariant & { values: ProductVariantValue[] };

const roundMoney = (value: number): number =>
    Math.round((value + Number.EPSILON) * 100) / 100;

function isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === '23505';
}

@Injectable()
export class ProductsService {
    constructor(
        @InjectRepository(Product) private readonly repo: Repository<Product>,
        @InjectRepository(Category) private readonly categories: Repository<Category>,
        @InjectRepository(Family) private readonly families: Repository<Family>,
        private readonly dataSource: DataSource,
        private readonly cache: CacheService,
    ) { }

    toPublic(product: Product): PublicProductWithDates {
        const images = [...(product.images ?? [])].sort(
            (a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime(),
        );
        const imageById = new Map(images.map((image) => [image.id, image]));
        const categories: PublicCategory<Date>[] = (product.productCategories ?? [])
            .map((link) => link.category)
            .filter((category): category is Category => Boolean(category))
            .map((category) => ({
                id: category.id,
                name: category.name,
                ref: category.ref,
                icon: category.icon ?? null,
                createdAt: category.createdAt,
                updatedAt: category.updatedAt,
            }));
        const families: PublicFamily<Date>[] = (product.families ?? []).map((family) => ({
            id: family.id,
            name: family.name,
            ref: family.ref,
            description: family.description ?? null,
            createdAt: family.createdAt,
            updatedAt: family.updatedAt,
        }));

        const variants: PublicProductVariant<Date>[] = [...(product.variants ?? [])]
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name))
            .map((variant) => ({
                id: variant.id,
                key: variant.id,
                name: variant.name,
                variantType: variant.variantType,
                values: [...(variant.values ?? [])]
                    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime())
                    .map((value) => {
                        const image = value.image ?? (value.imageId ? imageById.get(value.imageId) : undefined);
                        return {
                            id: value.id,
                            key: value.id,
                            value: value.value,
                            hexColor: value.hexColor ?? null,
                            imageId: value.imageId,
                            imageKey: image?.id ?? value.imageId,
                            imageUrl: image?.url ?? '',
                            position: value.position,
                            createdAt: value.createdAt,
                        };
                    }),
                createdAt: variant.createdAt,
            }));

        const skus: PublicProductSku<Date>[] = [...(product.skus ?? [])]
            .sort((a, b) => a.label.localeCompare(b.label) || a.sku.localeCompare(b.sku))
            .map((sku) => {
                const image = sku.image ?? imageById.get(sku.imageId ?? '');
                return {
                    id: sku.id,
                    productId: sku.productId,
                    sku: sku.sku,
                    combinationKey: sku.combinationKey,
                    label: sku.label,
                    imageId: sku.imageId ?? null,
                    imageUrl: image?.url ?? '',
                    stockQuantity: sku.stockQuantity,
                    PMP: sku.PMP,
                    isActive: sku.isActive,
                    variantValueIds: (sku.variantValues ?? []).map((value) => value.id).sort(),
                    createdAt: sku.createdAt,
                    updatedAt: sku.updatedAt,
                };
            });

        return {
            id: product.id,
            ref: product.ref,
            name: product.name,
            subtitle: product.subtitle ?? null,
            description: product.description ?? null,
            price: product.price,
            oldPrice: product.oldPrice ?? null,
            fakeReviews: product.fakeReviews,
            realReviews: product.realReviews,
            fakeSolds: product.fakeSolds,
            realSolds: product.realSolds,
            quantity: product.quantity,
            PMP: product.PMP,
            categories,
            families,
            images: images.map((image) => ({
                id: image.id,
                /** Existing database ids double as stable editor keys. */
                key: image.id,
                url: image.url,
                isMain: image.isMain,
                position: image.position,
                createdAt: image.createdAt,
            })),
            variants,
            skus,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
        };
    }

    async findAll(): Promise<PublicProductWithDates[]> {
        const load = async (): Promise<PublicProductWithDates[]> => {
            const products = await this.repo.find({
                relations: productRelations,
                order: { createdAt: 'DESC' },
            });
            return products.map((product) => this.toPublic(product));
        };
        return this.cache.getOrSet(CACHE_PREFIXES.catalog, CACHE_TTLS_SECONDS.catalog, load);
    }

    /**
     * Public catalog with database-level filtering and pagination. Joins carry
     * the full nested product payload; `getManyAndCount` de-duplicates roots
     * before applying skip/take, so one product never occupies several slots.
     */
    async findPaginated(dto: FindProductsDto): Promise<PaginatedProducts<Date>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 9;
        const key = catalogListKey({ ...dto, page, limit });

        const load = async (): Promise<PaginatedProducts<Date>> => {
            const query = this.repo.createQueryBuilder('product')
                .leftJoinAndSelect('product.productCategories', 'productCategories')
                .leftJoinAndSelect('productCategories.category', 'category')
                .leftJoinAndSelect('product.families', 'family')
                .leftJoinAndSelect('product.images', 'image')
                .leftJoinAndSelect('product.variants', 'variant')
                .leftJoinAndSelect('variant.values', 'variantValue')
                .leftJoinAndSelect('variantValue.image', 'variantValueImage')
                .leftJoinAndSelect('product.skus', 'sku')
                .leftJoinAndSelect('sku.variantValues', 'skuVariantValue')
                .leftJoinAndSelect('sku.image', 'skuImage');

            // EXISTS keeps every category/family on the returned product even
            // when the filter only matches one of them.
            if (dto.categoryId) {
                query.andWhere(
                    'EXISTS (SELECT 1 FROM product_categories pc WHERE pc."productId" = product.id AND pc."categoryId" = :categoryId)',
                    { categoryId: dto.categoryId },
                );
            }
            if (dto.familyId) {
                query.andWhere(
                    'EXISTS (SELECT 1 FROM product_families pf WHERE pf."productId" = product.id AND pf."familyId" = :familyId)',
                    { familyId: dto.familyId },
                );
            }
            if (dto.q) {
                query.andWhere(
                    '(product.name ILIKE :q OR product.ref ILIKE :q OR product.subtitle ILIKE :q OR product.description ILIKE :q OR category.name ILIKE :q OR family.name ILIKE :q)',
                    { q: `%${dto.q}%` },
                );
            }

            query
                .orderBy('product.createdAt', 'DESC')
                .addOrderBy('product.id', 'DESC')
                .skip((page - 1) * limit)
                .take(limit);

            const [products, total] = await query.getManyAndCount();
            return {
                items: products.map((product) => this.toPublic(product)),
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        };

        return this.cache.getOrSet(key, CACHE_TTLS_SECONDS.catalog, load);
    }

    async findOne(id: string): Promise<PublicProductWithDates> {
        const load = async (): Promise<PublicProductWithDates> => {
            const product = await this.repo.findOne({ where: { id }, relations: productRelations });
            if (!product) throw new NotFoundException('Product not found');
            return this.toPublic(product);
        };
        return this.cache.getOrSet(productKey(id), 60, load);
    }

    async create(dto: ProductDto): Promise<PublicProductWithDates> {
        this.validatePayload(dto);
        await this.assertRefFree(dto.ref);

        try {
            const result = await this.dataSource.transaction(async (manager) => {
                await this.assertCategories(manager, dto.categoryIds);
                const familyIds = await this.assertFamilies(manager, dto.familyIds ?? []);

                const product = await manager.save(
                    Product,
                    manager.create(Product, this.scalars(dto)),
                );
                const { skus } = await this.replaceChildren(
                    manager,
                    product.id,
                    dto,
                    [],
                    [],
                    [],
                    familyIds,
                );
                await this.recomputeProductAggregate(manager, product.id);
                return { id: product.id, skuIds: skus.map((sku) => sku.id) };
            });
            await this.invalidate(result.id, result.skuIds);
            return await this.findOne(result.id);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictException('A product with this ref already exists.');
            }
            throw error;
        }
    }

    async update(id: string, dto: ProductDto): Promise<PublicProductWithDates> {
        const existing = await this.repo.findOne({
            where: { id },
            relations: { families: true, skus: { variantValues: true } },
        });
        if (!existing) throw new NotFoundException('Product not found');

        this.validatePayload(dto);
        await this.assertRefFree(dto.ref, id);

        try {
            const result = await this.dataSource.transaction(async (manager) => {
                await this.assertCategories(manager, dto.categoryIds);
                const familyIds = await this.assertFamilies(
                    manager,
                    dto.familyIds ?? existing.families.map((family) => family.id),
                );
                await manager.update(Product, id, this.scalars(dto));

                const [existingImages, existingVariants] = await Promise.all([
                    manager.find(ProductImage, { where: { productId: id } }),
                    manager.find(ProductVariant, { where: { productId: id } }),
                ]);
                const existingValues = existingVariants.length > 0
                    ? await manager.find(ProductVariantValue, {
                        where: { variantId: In(existingVariants.map((variant) => variant.id)) },
                    })
                    : [];
                const { skus } = await this.replaceChildren(
                    manager,
                    id,
                    dto,
                    existingImages,
                    existingVariants,
                    existingValues,
                    familyIds,
                    existing.skus ?? [],
                );
                await this.recomputeProductAggregate(manager, id);
                return skus.map((sku) => sku.id);
            });
            await this.invalidate(id, result);
            return await this.findOne(id);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictException('A product with this ref already exists.');
            }
            throw error;
        }
    }

    async remove(id: string): Promise<void> {
        const product = await this.repo.findOne({ where: { id }, relations: { skus: true } });
        if (!product) throw new NotFoundException('Product not found');

        const skuIds = (product.skus ?? []).map((sku) => sku.id);

        // History rows always keep a productId, even when old SKU rows have been
        // removed. Checking only the current SKUs lets a product with orphaned
        // history reach the DELETE and fail on a RESTRICT foreign key (a 500).
        const usage = await this.repo.query(
            `SELECT
               (SELECT COUNT(*) FROM "order_items" WHERE "productId" = $1)
             + (SELECT COUNT(*) FROM "stock_movements" WHERE "productId" = $1)
             + (SELECT COUNT(*) FROM "stock_entry_items" WHERE "productId" = $1)
             + (SELECT COUNT(*) FROM "offer_single_rules" WHERE "productId" = $1)
             + (SELECT COUNT(*) FROM "offer_pack_items" WHERE "productId" = $1)
               AS "count"`,
            [id],
        );
        if (Number(usage[0]?.count ?? 0) > 0) {
            throw new ConflictException(
                'This product has stock, order or offer history and cannot be deleted.',
            );
        }

        await this.repo.delete({ id });
        await this.invalidate(id, skuIds);
    }

    private scalars(dto: ProductDto): Partial<Product> {
        return {
            ref: dto.ref,
            name: dto.name,
            subtitle: dto.subtitle ?? null,
            description: dto.description ?? null,
            price: dto.price,
            oldPrice: dto.oldPrice ?? null,
            fakeReviews: dto.fakeReviews,
            realReviews: dto.realReviews,
            fakeSolds: dto.fakeSolds,
            realSolds: dto.realSolds,
        };
    }

    private validatePayload(dto: ProductDto): void {
        if (dto.images.filter((image) => image.isMain === true).length !== 1) {
            throw new BadRequestException('Exactly one image must be marked as main.');
        }

        const imageKeys = dto.images.map((image) => image.key);
        if (new Set(imageKeys).size !== imageKeys.length) {
            throw new BadRequestException('Image keys must be unique.');
        }
        if (new Set(dto.images.map((image) => image.url)).size !== dto.images.length) {
            throw new BadRequestException('Image URLs must be unique.');
        }

        const variantKeys = dto.variants
            .map((variant) => variant.key)
            .filter((key): key is string => typeof key === 'string' && key.length > 0);
        if (new Set(variantKeys).size !== variantKeys.length) {
            throw new BadRequestException('Variant keys must be unique when provided.');
        }

        const knownKeys = new Set(imageKeys);
        const dimensions = new Set<string>();
        for (const variant of dto.variants) {
            const dimension = variantDimension(variant);
            if (dimensions.has(dimension)) {
                throw new BadRequestException(
                    'Only one variant is allowed per variant type (or custom name).',
                );
            }
            dimensions.add(dimension);

            if (!VARIANT_TYPES.includes(variant.variantType as VariantType)) {
                throw new BadRequestException('Invalid variant type.');
            }
            if (variant.variantType === 'OTHER' && variant.name.trim().length === 0) {
                throw new BadRequestException('OTHER variants require a custom type name.');
            }
            if (!Array.isArray(variant.values) || variant.values.length === 0) {
                throw new BadRequestException('Each variant requires at least one value.');
            }

            const valueKeys = variant.values
                .map((value) => value.key)
                .filter((key): key is string => typeof key === 'string' && key.length > 0);
            if (new Set(valueKeys).size !== valueKeys.length) {
                throw new BadRequestException('Variant value keys must be unique within a variant.');
            }

            const signatures = new Set<string>();
            for (const value of variant.values) {
                if (value.imageKey && !knownKeys.has(value.imageKey)) {
                    throw new BadRequestException(
                        'Each variant imageKey must reference an image in this product.',
                    );
                }
                const normalized = variantValue(value, variant.variantType);
                if (signatures.has(normalized)) {
                    throw new BadRequestException('Variant values must be unique within a dimension.');
                }
                signatures.add(normalized);

                if (variant.variantType === 'COLOR') {
                    if (!/^#[0-9A-Fa-f]{6}$/.test(value.hexColor ?? '')) {
                        throw new BadRequestException('A COLOR variant requires a valid #RRGGBB hex color.');
                    }
                } else if (value.hexColor !== undefined && value.hexColor !== null) {
                    throw new BadRequestException('hexColor is only allowed for COLOR variants.');
                }

                if (variant.variantType === 'SIZE_TEXT' && !SIZE_TEXT_VALUES.includes(normalized as never)) {
                    throw new BadRequestException('SIZE_TEXT values must be XS, S, M, L, XL, XXL or XXXL.');
                }
                if (variant.variantType === 'SIZE_NUM' && !/^\d+(\.\d{1,2})?$/.test(normalized)) {
                    throw new BadRequestException('SIZE_NUM values must be numeric.');
                }
            }
        }
    }

    private async assertRefFree(ref: string, exceptId?: string): Promise<void> {
        const existing = await this.repo.findOneBy({ ref });
        if (existing && existing.id !== exceptId) {
            throw new ConflictException('A product with this ref already exists.');
        }
    }

    private async assertCategories(manager: EntityManager, categoryIds: string[]): Promise<void> {
        const uniqueIds = [...new Set(categoryIds)];
        if (uniqueIds.length !== categoryIds.length) {
            throw new BadRequestException('categoryIds must not contain duplicates.');
        }
        const count = await manager.count(Category, { where: { id: In(uniqueIds) } });
        if (count !== uniqueIds.length) {
            throw new NotFoundException('One or more categories were not found.');
        }
    }

    private async assertFamilies(manager: EntityManager, familyIds: string[]): Promise<string[]> {
        const uniqueIds = [...new Set(familyIds)];
        if (uniqueIds.length !== familyIds.length) {
            throw new BadRequestException('familyIds must not contain duplicates.');
        }
        if (uniqueIds.length === 0) return uniqueIds;
        const count = await manager.count(Family, { where: { id: In(uniqueIds) } });
        if (count !== uniqueIds.length) {
            throw new NotFoundException('One or more families were not found.');
        }
        return uniqueIds;
    }

    /**
     * Replaces catalog children while keeping ids for stable editor keys.
     * Old variant rows are removed first: their FK cascade clears SKU links,
     * then `syncSkus` recreates links for every surviving combination.
     */
    private async replaceChildren(
        manager: EntityManager,
        productId: string,
        dto: ProductDto,
        existingImages: ProductImage[],
        existingVariants: ProductVariant[],
        existingValues: ProductVariantValue[],
        familyIds: string[],
        existingSkus: ProductSku[] = [],
    ): Promise<{ variants: SavedVariant[]; skus: ProductSku[] }> {
        if (existingVariants.length > 0) {
            await manager.delete(ProductVariant, { id: In(existingVariants.map((variant) => variant.id)) });
        }
        if (existingImages.length > 0) {
            await manager.delete(ProductImage, { id: In(existingImages.map((image) => image.id)) });
        }
        await manager.delete(ProductCategory, { productId });

        await manager.save(
            ProductCategory,
            dto.categoryIds.map((categoryId) =>
                manager.create(ProductCategory, { productId, categoryId }),
            ),
        );
        await manager.query('DELETE FROM "product_families" WHERE "productId" = $1', [productId]);
        for (const familyId of familyIds) {
            await manager.query(
                'INSERT INTO "product_families" ("familyId", "productId") VALUES ($1, $2)',
                [familyId, productId],
            );
        }

        const imageById = new Map(existingImages.map((image) => [image.id, image]));
        const savedImages: ProductImage[] = [];
        for (const item of dto.images) {
            const existing = imageById.get(item.key);
            const image = manager.create(ProductImage, {
                id: existing?.id ?? randomUUID(),
                productId,
                url: item.url,
                position: item.position,
                isMain: item.isMain,
                ...(existing ? { createdAt: existing.createdAt } : {}),
            });
            savedImages.push(await manager.save(ProductImage, image));
        }

        const variantById = new Map(existingVariants.map((variant) => [variant.id, variant]));
        const valuesByVariantId = new Map<string, Map<string, ProductVariantValue>>();
        for (const value of existingValues) {
            const values = valuesByVariantId.get(value.variantId) ?? new Map<string, ProductVariantValue>();
            values.set(value.id, value);
            valuesByVariantId.set(value.variantId, values);
        }
        const imageIdByKey = new Map(dto.images.map((item, index) => [item.key, savedImages[index].id]));
        const savedVariants: SavedVariant[] = [];
        for (const item of dto.variants) {
            const existing = item.key ? variantById.get(item.key) : undefined;
            const variantId = existing?.id ?? randomUUID();
            const variant = manager.create(ProductVariant, {
                id: variantId,
                productId,
                name: item.name.trim(),
                variantType: item.variantType,
                ...(existing ? { createdAt: existing.createdAt } : {}),
            }) as ProductVariant;
            const savedVariant = await manager.save(ProductVariant, variant) as ProductVariant;

            const existingValueById = valuesByVariantId.get(variantId);
            const values: ProductVariantValue[] = [];
            for (const [index, valueItem] of item.values.entries()) {
                const existingValue = valueItem.key ? existingValueById?.get(valueItem.key) : undefined;
                let imageId: string | null = null;
                if (valueItem.imageKey) {
                    imageId = imageIdByKey.get(valueItem.imageKey) ?? null;
                    if (!imageId) {
                        throw new BadRequestException(
                            'Each variant imageKey must reference an image in this product.',
                        );
                    }
                }
                const value = manager.create(ProductVariantValue, {
                    id: existingValue?.id ?? randomUUID(),
                    variantId: savedVariant.id,
                    value: valueItem.value.trim(),
                    hexColor: item.variantType === 'COLOR' ? (valueItem.hexColor ?? null) : null,
                    imageId,
                    position: index,
                    ...(existingValue ? { createdAt: existingValue.createdAt } : {}),
                });
                values.push(await manager.save(ProductVariantValue, value));
            }
            savedVariants.push({ ...savedVariant, values });
        }

        const skus = await this.syncSkus(
            manager,
            productId,
            dto.ref,
            savedVariants,
            savedImages,
            existingSkus,
        );
        return { variants: savedVariants, skus };
    }

    /** Keeps stock attached to unchanged combinations and retires removed ones. */
    private async syncSkus(
        manager: EntityManager,
        productId: string,
        ref: string,
        variants: SavedVariant[],
        images: ProductImage[],
        existingSkus: ProductSku[],
    ): Promise<ProductSku[]> {
        const mainImage = images.find((image) => image.isMain) ?? images[0];
        const byValueIds = new Map(
            existingSkus.map((sku) => [
                variantValueIdKey((sku.variantValues ?? []).map((value) => value.id)),
                sku,
            ]),
        );
        const byCombination = new Map(existingSkus.map((sku) => [sku.combinationKey, sku]));
        const retainedIds = new Set<string>();
        const saved: ProductSku[] = [];

        for (const group of valueCombinations(variants)) {
            const combination = buildCombination(group, mainImage?.id ?? null);
            const valueKey = variantValueIdKey(combination.variantValueIds);
            // Prefer exact value ids so a renamed label keeps its stock.
            const existing =
                byValueIds.get(valueKey) ?? byCombination.get(combination.combinationKey);
            const sku = manager.create(ProductSku, {
                id: existing?.id ?? randomUUID(),
                productId,
                sku: existing?.sku ?? skuCode(ref, combination.combinationKey),
                combinationKey: combination.combinationKey,
                label: combination.label,
                imageId: combination.imageId,
                stockQuantity: existing?.stockQuantity ?? 0,
                PMP: existing?.PMP ?? 0,
                isActive: true,
                ...(existing ? { createdAt: existing.createdAt } : {}),
            });
            const result = await manager.save(ProductSku, sku);
            saved.push(result);
            if (existing) {
                // A combination-key match may have been found in a different map,
                // so remove every index entry for that SKU before the next loop.
                for (const [key, candidate] of byValueIds) {
                    if (candidate.id === existing.id) byValueIds.delete(key);
                }
                byCombination.delete(existing.combinationKey);
                retainedIds.add(existing.id);
            }

            await manager.query('DELETE FROM "product_sku_variant_values" WHERE "skuId" = $1', [result.id]);
            for (const variantValueId of combination.variantValueIds) {
                await manager.query(
                    'INSERT INTO "product_sku_variant_values" ("skuId", "variantValueId") VALUES ($1, $2)',
                    [result.id, variantValueId],
                );
            }
        }

        for (const sku of existingSkus) {
            if (!retainedIds.has(sku.id) && sku.isActive) {
                await manager.save(ProductSku, { id: sku.id, isActive: false });
            }
        }
        return saved;
    }

    /** Product-level quantity is the aggregate of active, sellable SKUs. */
    private async recomputeProductAggregate(manager: EntityManager, productId: string): Promise<void> {
        const skus = await manager.find(ProductSku, { where: { productId, isActive: true } });
        const quantity = skus.reduce((sum, sku) => sum + sku.stockQuantity, 0);
        const weighted = skus.reduce((sum, sku) => sum + sku.PMP * sku.stockQuantity, 0);
        const PMP = quantity > 0 ? roundMoney(weighted / quantity) : 0;
        await manager.update(Product, productId, { quantity, PMP });
    }

    private async invalidate(productId: string, skuIds: string[]): Promise<void> {
        // Paginated keys embed the query, so clear the whole catalog namespace.
        await this.cache.invalidatePrefix(CACHE_PREFIXES.catalog);
        await this.cache.invalidate(
            CACHE_PREFIXES.families,
            CACHE_PREFIXES.offersActive,
            CACHE_PREFIXES.stockAvailability,
            productKey(productId),
            ...skuIds.map(skuKey),
        );
    }
}
