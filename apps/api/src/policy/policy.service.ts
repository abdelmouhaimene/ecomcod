import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PublicPolicyArticle } from '@repo/types';
import { Repository } from 'typeorm';
import { PolicyArticleDto } from './dto/policy.dto.js';
import { PolicyArticle } from './entities/policy-article.entity.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicPolicyArticleWithDates = PublicPolicyArticle<Date>;

@Injectable()
export class PolicyService {
    constructor(
        @InjectRepository(PolicyArticle) private readonly articles: Repository<PolicyArticle>,
    ) { }

    toPublic(article: PolicyArticle): PublicPolicyArticleWithDates {
        return {
            id: article.id,
            title: article.title,
            body: article.body,
            position: article.position,
            isActive: article.isActive,
            createdAt: article.createdAt,
            updatedAt: article.updatedAt,
        };
    }

    /** Admin list includes hidden entries so they can be edited again. */
    async findAll(): Promise<PublicPolicyArticleWithDates[]> {
        const articles = await this.articles.find({
            order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
        });
        return articles.map((article) => this.toPublic(article));
    }

    async findActive(): Promise<PublicPolicyArticleWithDates[]> {
        const articles = await this.articles.find({
            where: { isActive: true },
            order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
        });
        return articles.map((article) => this.toPublic(article));
    }

    async findOne(id: string): Promise<PublicPolicyArticleWithDates> {
        const article = await this.articles.findOneBy({ id });
        if (!article) throw new NotFoundException('Policy article not found');
        return this.toPublic(article);
    }

    async create(dto: PolicyArticleDto): Promise<PublicPolicyArticleWithDates> {
        const article = this.articles.create({
            title: dto.title,
            body: dto.body,
            position: dto.position ?? 0,
            isActive: dto.isActive ?? true,
        });
        const saved = await this.articles.save(article);
        return this.toPublic(saved);
    }

    async update(id: string, dto: PolicyArticleDto): Promise<PublicPolicyArticleWithDates> {
        const article = await this.articles.findOneBy({ id });
        if (!article) throw new NotFoundException('Policy article not found');

        article.title = dto.title;
        article.body = dto.body;
        if (dto.position !== undefined) article.position = dto.position;
        if (dto.isActive !== undefined) article.isActive = dto.isActive;

        const saved = await this.articles.save(article);
        return this.toPublic(saved);
    }

    async remove(id: string): Promise<void> {
        const article = await this.articles.findOneBy({ id });
        if (!article) throw new NotFoundException('Policy article not found');
        await this.articles.delete({ id });
    }
}
