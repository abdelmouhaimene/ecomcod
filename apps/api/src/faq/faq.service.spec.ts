import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FaqDto } from './dto/faq.dto.js';
import { FaqItem } from './entities/faq-item.entity.js';
import { FaqService } from './faq.service.js';

const dates = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

function faqItem(overrides: Partial<FaqItem> = {}): FaqItem {
    return {
        id: 'faq-1',
        question: 'How long is delivery?',
        answer: 'Two to three working days.',
        position: 2,
        isActive: true,
        ...dates,
        ...overrides,
    } as FaqItem;
}

describe('FaqService', () => {
    let service: FaqService;
    let items: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(async () => {
        items = {
            find: vi.fn(async () => [faqItem()]),
            findOneBy: vi.fn(async () => faqItem()),
            create: vi.fn((value: Record<string, unknown>) => ({ ...value, ...dates })),
            save: vi.fn(async (value: Record<string, unknown>) => ({ ...value, id: 'faq-1', ...dates })),
            delete: vi.fn(async () => ({ affected: 1 })),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FaqService,
                { provide: getRepositoryToken(FaqItem), useValue: items },
            ],
        }).compile();
        service = module.get(FaqService);
    });

    it('returns all entries in display order for admins', async () => {
        await expect(service.findAll()).resolves.toEqual([
            expect.objectContaining({
                id: 'faq-1',
                question: 'How long is delivery?',
                position: 2,
                isActive: true,
            }),
        ]);
        expect(items.find).toHaveBeenCalledWith({
            order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
        });
    });

    it('returns only active entries for the storefront', async () => {
        await expect(service.findActive()).resolves.toHaveLength(1);
        expect(items.find).toHaveBeenCalledWith({
            where: { isActive: true },
            order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
        });
    });

    it('uses defaults on create and preserves omitted fields on update', async () => {
        await expect(service.create({
            question: 'New question?',
            answer: 'New answer.',
        } as FaqDto)).resolves.toMatchObject({
            question: 'New question?',
            answer: 'New answer.',
            position: 0,
            isActive: true,
        });

        await expect(service.update('faq-1', {
            question: 'Updated question?',
            answer: 'Updated answer.',
            position: 5,
        } as FaqDto)).resolves.toMatchObject({
            position: 5,
            isActive: true,
        });
        expect(items.save).toHaveBeenCalledWith(
            expect.objectContaining({ question: 'Updated question?', isActive: true }),
        );
    });

    it('deletes an existing entry and reports missing ones', async () => {
        await expect(service.remove('faq-1')).resolves.toBeUndefined();
        expect(items.delete).toHaveBeenCalledWith({ id: 'faq-1' });

        items.findOneBy.mockResolvedValueOnce(null);
        await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
        items.findOneBy.mockResolvedValue(null);
        await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.update('missing', {
            question: 'Question?',
            answer: 'Answer.',
        } as FaqDto)).rejects.toBeInstanceOf(NotFoundException);
    });
});
