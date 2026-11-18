import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PublicSupplier, SupplierPayload } from '@repo/types';
import { Repository } from 'typeorm';
import { StockEntry } from './entities/stock-entry.entity.js';
import { Supplier } from './entities/supplier.entity.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicSupplierWithDates = PublicSupplier<Date>;

function isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === '23505';
}

@Injectable()
export class SuppliersService {
    constructor(
        @InjectRepository(Supplier) private readonly repo: Repository<Supplier>,
        @InjectRepository(StockEntry) private readonly entries: Repository<StockEntry>,
    ) { }

    toPublic(supplier: Supplier): PublicSupplierWithDates {
        return {
            id: supplier.id,
            name: supplier.name,
            createdAt: supplier.createdAt,
            updatedAt: supplier.updatedAt,
        };
    }

    async findAll(): Promise<PublicSupplierWithDates[]> {
        const suppliers = await this.repo.find({ order: { name: 'ASC' } });
        return suppliers.map((supplier) => this.toPublic(supplier));
    }

    async findOne(id: string): Promise<PublicSupplierWithDates> {
        const supplier = await this.repo.findOneBy({ id });
        if (!supplier) throw new NotFoundException('Supplier not found');
        return this.toPublic(supplier);
    }

    async create(dto: SupplierPayload): Promise<PublicSupplierWithDates> {
        const name = dto.name.trim();
        const existing = await this.repo.findOneBy({ name });
        if (existing) throw new ConflictException('A supplier with this name already exists.');

        try {
            const supplier = this.repo.create({ name });
            await this.repo.save(supplier);
            return this.toPublic(supplier);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictException('A supplier with this name already exists.');
            }
            throw error;
        }
    }

    async update(id: string, dto: SupplierPayload): Promise<PublicSupplierWithDates> {
        const supplier = await this.repo.findOneBy({ id });
        if (!supplier) throw new NotFoundException('Supplier not found');

        const name = dto.name.trim();
        const existing = await this.repo.findOneBy({ name });
        if (existing && existing.id !== id) {
            throw new ConflictException('A supplier with this name already exists.');
        }

        supplier.name = name;
        try {
            await this.repo.save(supplier);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictException('A supplier with this name already exists.');
            }
            throw error;
        }
        return this.toPublic(supplier);
    }

    async remove(id: string): Promise<void> {
        const supplier = await this.repo.findOneBy({ id });
        if (!supplier) throw new NotFoundException('Supplier not found');

        const usageCount = await this.entries.count({ where: { supplierId: id } });
        if (usageCount > 0) {
            throw new ConflictException('This supplier is used by stock entries and cannot be deleted.');
        }
        await this.repo.delete({ id });
    }
}
