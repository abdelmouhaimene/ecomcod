import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PublicFaqItem } from '@repo/types';
import { Repository } from 'typeorm';
import { FaqDto } from './dto/faq.dto.js';
import { FaqItem } from './entities/faq-item.entity.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicFaqItemWithDates = PublicFaqItem<Date>;

@Injectable()
export class FaqService {
    constructor(@InjectRepository(FaqItem) private readonly items: Repository<FaqItem>) { }

    toPublic(item: FaqItem): PublicFaqItemWithDates {
        return {
            id: item.id,
            question: item.question,
            answer: item.answer,
            position: item.position,
            isActive: item.isActive,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        };
    }

    /** Admin list includes hidden entries so they can be edited again. */
    async findAll(): Promise<PublicFaqItemWithDates[]> {
        const items = await this.items.find({
            order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
        });
        return items.map((item) => this.toPublic(item));
    }

    async findActive(): Promise<PublicFaqItemWithDates[]> {
        const items = await this.items.find({
            where: { isActive: true },
            order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
        });
        return items.map((item) => this.toPublic(item));
    }

    async findOne(id: string): Promise<PublicFaqItemWithDates> {
        const item = await this.items.findOneBy({ id });
        if (!item) throw new NotFoundException('FAQ item not found');
        return this.toPublic(item);
    }

    async create(dto: FaqDto): Promise<PublicFaqItemWithDates> {
        const item = this.items.create({
            question: dto.question,
            answer: dto.answer,
            position: dto.position ?? 0,
            isActive: dto.isActive ?? true,
        });
        const saved = await this.items.save(item);
        return this.toPublic(saved);
    }

    async update(id: string, dto: FaqDto): Promise<PublicFaqItemWithDates> {
        const item = await this.items.findOneBy({ id });
        if (!item) throw new NotFoundException('FAQ item not found');

        item.question = dto.question;
        item.answer = dto.answer;
        if (dto.position !== undefined) item.position = dto.position;
        if (dto.isActive !== undefined) item.isActive = dto.isActive;

        const saved = await this.items.save(item);
        return this.toPublic(saved);
    }

    async remove(id: string): Promise<void> {
        const item = await this.items.findOneBy({ id });
        if (!item) throw new NotFoundException('FAQ item not found');
        await this.items.delete({ id });
    }
}
