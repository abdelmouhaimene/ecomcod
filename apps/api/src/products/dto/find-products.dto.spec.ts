import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { FindProductsDto } from './find-products.dto.js';

const categoryId = '11111111-1111-4111-8111-111111111111';
const familyId = '22222222-2222-4222-8222-222222222222';

function messages(error: ValidationError): string[] {
    return [
        ...Object.values(error.constraints ?? {}),
        ...(error.children ?? []).flatMap(messages),
    ];
}

function errors(query: Record<string, unknown>): string[] {
    return validateSync(plainToInstance(FindProductsDto, query)).flatMap(messages);
}

describe('FindProductsDto', () => {
    it('applies defaults and coerces numeric query strings', () => {
        const dto = plainToInstance(FindProductsDto, {});
        expect(dto.page).toBe(1);
        expect(dto.limit).toBe(9);
        expect(errors({})).toEqual([]);

        const paged = plainToInstance(FindProductsDto, { page: '3', limit: '9' });
        expect(paged.page).toBe(3);
        expect(paged.limit).toBe(9);
    });

    it('trims search/filters and treats empty values as omitted', () => {
        const dto = plainToInstance(FindProductsDto, {
            page: '',
            q: '  headphones  ',
            categoryId: ` ${categoryId} `,
            familyId: '   ',
        });
        expect(errors({
            page: '',
            q: '  headphones  ',
            categoryId: ` ${categoryId} `,
            familyId: '   ',
        })).toEqual([]);
        expect(dto.q).toBe('headphones');
        expect(dto.categoryId).toBe(categoryId);
        expect(dto.familyId).toBeUndefined();
    });

    it('rejects invalid pagination and malformed ids', () => {
        expect(errors({ page: '0' }).join(' ')).toContain('page must not be less than 1');
        expect(errors({ limit: '1001' }).join(' ')).toContain('limit must not be greater than 1000');
        expect(errors({ categoryId: 'not-a-uuid' }).join(' ')).toContain('categoryId must be a UUID');
        expect(errors({ familyId })).toEqual([]);
    });

    it('whitelists only known query parameters', () => {
        const validation = validateSync(
            plainToInstance(FindProductsDto, { q: 'audio', sort: 'price' }),
            { whitelist: true, forbidNonWhitelisted: true },
        );
        expect(validation.flatMap(messages)).toContain('property sort should not exist');
    });
});
