import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_PREFIXES } from '../cache/cache-keys.js';
import { CacheService } from '../cache/cache.service.js';
import type { PublicFamily } from '@repo/types';
import { Repository } from 'typeorm';
import { Family } from './entities/family.entity.js';

export type PublicFamilyWithDates = PublicFamily<Date>;

function isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === '23505';
}

@Injectable()
export class FamiliesService {
    constructor(
        @InjectRepository(Family) private readonly repo: Repository<Family>,
        private readonly cache: CacheService,
    ) { }

    toPublic(family: Family): PublicFamilyWithDates {
        return {
            id: family.id,
            name: family.name,
            ref: family.ref,
            description: family.description ?? null,
            createdAt: family.createdAt,
            updatedAt: family.updatedAt,
        };
    }

    async findAll(): Promise<PublicFamilyWithDates[]> {
        return this.cache.getOrSet(CACHE_PREFIXES.families, 300, async () => {
            const families = await this.repo.find({ order: { name: 'ASC' } });
            return families.map((family) => this.toPublic(family));
        });
    }

    async findOne(id: string): Promise<PublicFamilyWithDates> {
        const family = await this.repo.findOneBy({ id });
        if (!family) throw new NotFoundException('Family not found');
        return this.toPublic(family);
    }

    async create(dto: FamilyPayloadInput): Promise<PublicFamilyWithDates> {
        const name = dto.name.trim();
        const ref = dto.ref.trim();
        await this.assertUnique(name, ref);
        try {
            const family = this.repo.create({
                name,
                ref,
                description: dto.description?.trim() ?? null,
            });
            await this.repo.save(family);
            await this.invalidate();
            return this.toPublic(family);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictException('A family with this name or ref already exists.');
            }
            throw error;
        }
    }

    async update(id: string, dto: FamilyPayloadInput): Promise<PublicFamilyWithDates> {
        const family = await this.repo.findOneBy({ id });
        if (!family) throw new NotFoundException('Family not found');

        const name = dto.name.trim();
        const ref = dto.ref.trim();
        await this.assertUnique(name, ref, id);
        family.name = name;
        family.ref = ref;
        family.description = dto.description?.trim() ?? null;
        try {
            await this.repo.save(family);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictException('A family with this name or ref already exists.');
            }
            throw error;
        }
        await this.invalidate();
        return this.toPublic(family);
    }

    async remove(id: string): Promise<void> {
        const family = await this.repo.findOneBy({ id });
        if (!family) throw new NotFoundException('Family not found');

        // FK_product_families_family is ON DELETE CASCADE: deleting the family
        // removes its product links automatically. Families are only a grouping
        // label, so products must survive the family being removed.
        await this.repo.delete({ id });
        await this.invalidate();
    }

    private async assertUnique(name: string, ref: string, exceptId?: string): Promise<void> {
        const existing = await this.repo
            .createQueryBuilder('family')
            .select(['family.id', 'family.name', 'family.ref'])
            .where('family.name = :name OR family.ref = :ref', { name, ref })
            .getMany();
        const others = existing.filter((family) => family.id !== exceptId);
        if (others.some((family) => family.name === name)) {
            throw new ConflictException('A family with this name already exists.');
        }
        if (others.some((family) => family.ref === ref)) {
            throw new ConflictException('A family with this ref already exists.');
        }
    }

    private async invalidate(): Promise<void> {
        await this.cache.invalidate(CACHE_PREFIXES.families, CACHE_PREFIXES.catalog);
        // Cached products embed their families, so clear those too.
        await this.cache.invalidatePrefix(CACHE_PREFIXES.product);
    }
}

interface FamilyPayloadInput {
    name: string;
    ref: string;
    description?: string | null;
}
