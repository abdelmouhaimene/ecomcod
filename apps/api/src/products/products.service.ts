import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PublicCategory, PublicProduct } from '@repo/types';
import { randomUUID } from 'node:crypto';
import {
  DataSource,
  In,
  type EntityManager,
  type Repository,
} from 'typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { ProductDto } from './dto/product.dto.js';
import { ProductCategory } from './entities/product-category.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { Product } from './entities/product.entity.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicProductWithDates = PublicProduct<Date>;

const productRelations = {
  productCategories: { category: true },
  images: true,
  variants: { image: true },
} as const;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly repo: Repository<Product>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    private readonly dataSource: DataSource,
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
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }));

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
      categories,
      images: images.map((image) => ({
        id: image.id,
        /** Existing database ids double as stable editor keys. */
        key: image.id,
        url: image.url,
        isMain: image.isMain,
        position: image.position,
        createdAt: image.createdAt,
      })),
      variants: (product.variants ?? []).map((variant) => {
        const image = variant.image ?? imageById.get(variant.imageId);
        return {
          id: variant.id,
          key: variant.id,
          name: variant.name,
          value: variant.value,
          price: variant.price,
          imageId: variant.imageId,
          imageKey: image?.id ?? variant.imageId,
          imageUrl: image?.url ?? '',
          createdAt: variant.createdAt,
        };
      }),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  async findAll(): Promise<PublicProductWithDates[]> {
    const products = await this.repo.find({
      relations: productRelations,
      order: { createdAt: 'DESC' },
    });
    return products.map((product) => this.toPublic(product));
  }

  async findOne(id: string): Promise<PublicProductWithDates> {
    const product = await this.repo.findOne({ where: { id }, relations: productRelations });
    if (!product) throw new NotFoundException('Product not found');
    return this.toPublic(product);
  }

  async create(dto: ProductDto): Promise<PublicProductWithDates> {
    this.validatePayload(dto);
    await this.assertRefFree(dto.ref);

    try {
      const id = await this.dataSource.transaction(async (manager) => {
        await this.assertCategories(manager, dto.categoryIds);

        const product = await manager.save(
          Product,
          manager.create(Product, this.scalars(dto)),
        );
        await this.replaceChildren(manager, product.id, dto, [], []);
        return product.id;
      });
      return await this.findOne(id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A product with this ref already exists.');
      }
      throw error;
    }
  }

  async update(id: string, dto: ProductDto): Promise<PublicProductWithDates> {
    const existing = await this.repo.findOneBy({ id });
    if (!existing) throw new NotFoundException('Product not found');

    this.validatePayload(dto);
    await this.assertRefFree(dto.ref, id);

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.assertCategories(manager, dto.categoryIds);
        await manager.update(Product, id, this.scalars(dto));

        const [existingImages, existingVariants] = await Promise.all([
          manager.find(ProductImage, { where: { productId: id } }),
          manager.find(ProductVariant, { where: { productId: id } }),
        ]);
        await this.replaceChildren(manager, id, dto, existingImages, existingVariants);
      });
      return await this.findOne(id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A product with this ref already exists.');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException('Product not found');
    await this.repo.delete({ id });
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
    for (const variant of dto.variants) {
      if (!knownKeys.has(variant.imageKey)) {
        throw new BadRequestException('Each variant imageKey must reference an image in this product.');
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

  /** Deletes then recreates children, keeping ids for keys that already exist. */
  private async replaceChildren(
    manager: EntityManager,
    productId: string,
    dto: ProductDto,
    existingImages: ProductImage[],
    existingVariants: ProductVariant[],
  ): Promise<void> {
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
    const imageIdByKey = new Map(
      dto.images.map((item, index) => [item.key, savedImages[index].id]),
    );
    for (const item of dto.variants) {
      const existing = item.key ? variantById.get(item.key) : undefined;
      const imageId = imageIdByKey.get(item.imageKey);
      if (!imageId) {
        throw new BadRequestException('Each variant imageKey must reference an image in this product.');
      }
      const variant = manager.create(ProductVariant, {
        id: existing?.id ?? randomUUID(),
        productId,
        name: item.name,
        value: item.value,
        price: item.price,
        imageId,
        ...(existing ? { createdAt: existing.createdAt } : {}),
      });
      await manager.save(ProductVariant, variant);
    }
  }
}
