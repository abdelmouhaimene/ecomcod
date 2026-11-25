import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PolicyArticleDto } from './dto/policy.dto.js';
import { PolicyArticle } from './entities/policy-article.entity.js';
import { PolicyService } from './policy.service.js';

const dates = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

function article(overrides: Partial<PolicyArticle> = {}): PolicyArticle {
    return {
        id: 'policy-1',
        title: 'Returns',
        body: 'Contact us before sending anything back.',
        position: 1,
        isActive: true,
        ...dates,
        ...overrides,
    } as PolicyArticle;
}

describe('PolicyService', () => {
    let service: PolicyService;
    let articles: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(async () => {
        articles = {
            find: vi.fn(async () => [article()]),
            findOneBy: vi.fn(async () => article()),
            create: vi.fn((value: Record<string, unknown>) => ({ ...value, ...dates })),
            save: vi.fn(async (value: Record<string, unknown>) => ({ ...value, id: 'policy-1', ...dates })),
            delete: vi.fn(async () => ({ affected: 1 })),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PolicyService,
                { provide: getRepositoryToken(PolicyArticle), useValue: articles },
            ],
        }).compile();
        service = module.get(PolicyService);
    });

    it('returns all articles in display order for admins', async () => {
        await expect(service.findAll()).resolves.toEqual([
            expect.objectContaining({
                id: 'policy-1',
                title: 'Returns',
                position: 1,
                isActive: true,
            }),
        ]);
        expect(articles.find).toHaveBeenCalledWith({
            order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
        });
    });

    it('returns only active articles for the storefront', async () => {
        await expect(service.findActive()).resolves.toHaveLength(1);
        expect(articles.find).toHaveBeenCalledWith({
            where: { isActive: true },
            order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
        });
    });

    it('uses defaults on create and preserves omitted fields on update', async () => {
        await expect(service.create({
            title: 'Privacy',
            body: 'We protect your data.',
        } as PolicyArticleDto)).resolves.toMatchObject({
            title: 'Privacy',
            body: 'We protect your data.',
            position: 0,
            isActive: true,
        });

        await expect(service.update('policy-1', {
            title: 'Updated title',
            body: 'Updated body.',
            position: 4,
        } as PolicyArticleDto)).resolves.toMatchObject({
            position: 4,
            isActive: true,
        });
        expect(articles.save).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Updated title', isActive: true }),
        );
    });

    it('deletes an existing article and reports missing ones', async () => {
        await expect(service.remove('policy-1')).resolves.toBeUndefined();
        expect(articles.delete).toHaveBeenCalledWith({ id: 'policy-1' });

        articles.findOneBy.mockResolvedValueOnce(null);
        await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
        articles.findOneBy.mockResolvedValue(null);
        await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.update('missing', {
            title: 'Title',
            body: 'Body.',
        } as PolicyArticleDto)).rejects.toBeInstanceOf(NotFoundException);
    });
});
