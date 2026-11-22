import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { CategoryPayload, PublicCategory } from '@repo/types';
import { Repository } from 'typeorm';
import { ProductCategory } from '../products/entities/product-category.entity.js';
import { Category } from './entities/category.entity.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicCategoryWithDates = PublicCategory<Date>;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}

function normalizeIcon(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly repo: Repository<Category>,
    @InjectRepository(ProductCategory)
    private readonly productCategories: Repository<ProductCategory>,
  ) { }

  toPublic(category: Category): PublicCategoryWithDates {
    return {
      id: category.id,
      name: category.name,
      ref: category.ref,
      icon: category.icon ?? null,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async findAll(): Promise<PublicCategoryWithDates[]> {
    const categories = await this.repo.find({ order: { name: 'ASC' } });
    return categories.map((category) => this.toPublic(category));
  }

  async findOne(id: string): Promise<PublicCategoryWithDates> {
    const category = await this.repo.findOneBy({ id });
    if (!category) throw new NotFoundException('Category not found');
    return this.toPublic(category);
  }

  async create(dto: CategoryPayload): Promise<PublicCategoryWithDates> {
    const name = dto.name.trim();
    const ref = dto.ref.trim();
    await this.assertUnique(name, ref);

    try {
      const category = this.repo.create({ name, ref, icon: normalizeIcon(dto.icon) });
      await this.repo.save(category);
      return this.toPublic(category);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A category with this name or ref already exists.');
      }
      throw error;
    }
  }

  async update(id: string, dto: CategoryPayload): Promise<PublicCategoryWithDates> {
    const category = await this.repo.findOneBy({ id });
    if (!category) throw new NotFoundException('Category not found');

    const name = dto.name.trim();
    const ref = dto.ref.trim();
    await this.assertUnique(name, ref, id);

    category.name = name;
    category.ref = ref;
    category.icon = normalizeIcon(dto.icon);
    try {
      await this.repo.save(category);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A category with this name or ref already exists.');
      }
      throw error;
    }
    return this.toPublic(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.repo.findOneBy({ id });
    if (!category) throw new NotFoundException('Category not found');

    const usageCount = await this.productCategories.count({ where: { categoryId: id } });
    if (usageCount > 0) {
      throw new ConflictException('This category is still used by products and cannot be deleted.');
    }

    await this.repo.delete({ id });
  }

  private async assertUnique(name: string, ref: string, exceptId?: string): Promise<void> {
    const existing = await this.repo
      .createQueryBuilder('category')
      .select(['category.id', 'category.name', 'category.ref'])
      .where('category.name = :name OR category.ref = :ref', { name, ref })
      .getMany();

    const others = existing.filter((category) => category.id !== exceptId);
    if (others.some((category) => category.name === name)) {
      throw new ConflictException('A category with this name already exists.');
    }
    if (others.some((category) => category.ref === ref)) {
      throw new ConflictException('A category with this ref already exists.');
    }
  }
}
