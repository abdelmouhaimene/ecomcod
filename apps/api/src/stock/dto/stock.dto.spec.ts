import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { StockEntryDto, StockEntryFilterDto, SupplierDto } from './stock.dto.js';

const productId = '11111111-1111-4111-8111-111111111111';
const supplierId = '22222222-2222-4222-8222-222222222222';

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        date: '2026-11-18',
        supplierId,
        items: [{ productId, quantity: '3', unitPrice: '12.50' }],
        ...overrides,
    };
}

function messages(error: ValidationError): string[] {
    return [
        ...Object.values(error.constraints ?? {}),
        ...(error.children ?? []).flatMap(messages),
    ];
}

function errors(overrides: Record<string, unknown> = {}): string[] {
    const dto = plainToInstance(StockEntryDto, payload(overrides));
    return (validateSync(dto) ?? []).flatMap(messages);
}

describe('Stock DTOs', () => {
    it('coerces numbers and accepts a calendar date', () => {
        expect(errors()).toEqual([]);
        const dto = plainToInstance(StockEntryDto, payload());
        expect(dto.date).toBe('2026-11-18');
        expect(dto.items[0].quantity).toBe(3);
        expect(dto.items[0].unitPrice).toBe(12.5);
    });

    it('rejects invalid dates, suppliers and empty or duplicate lines', () => {
        expect(errors({ date: '2026-02-30' }).join(' ')).toContain('valid YYYY-MM-DD');
        expect(errors({ date: '18/11/2026' }).join(' ')).toContain('valid YYYY-MM-DD');
        expect(errors({ supplierId: 'nope' }).join(' ')).toContain('supplierId must be a UUID');
        expect(errors({ items: [] }).join(' ')).toContain('items should not be empty');
        expect(errors({ items: [
            { productId, quantity: 1, unitPrice: 1 },
            { productId, quantity: 2, unitPrice: 1 },
        ] }).join(' ')).toContain('A product can appear only once');
    });

    it('requires positive integer quantities and two-decimal unit prices', () => {
        expect(errors({ items: [{ productId, quantity: 0, unitPrice: 1 }] }).join(' '))
            .toContain('quantity must not be less than 1');
        expect(errors({ items: [{ productId, quantity: 1.5, unitPrice: 1 }] }).join(' '))
            .toContain('quantity must be an integer number');
        expect(errors({ items: [{ productId, quantity: 1, unitPrice: -1 }] }).join(' '))
            .toContain('unitPrice must not be less than 0');
        expect(errors({ items: [{ productId, quantity: 1, unitPrice: 1.234 }] }).join(' '))
            .toContain('unitPrice must have at most two decimal places');
    });

    it('validates supplier names and list filters', () => {
        const supplier = plainToInstance(SupplierDto, { name: '  Acme  ' });
        expect(validateSync(supplier)).toEqual([]);
        expect(supplier.name).toBe('Acme');
        expect(validateSync(plainToInstance(SupplierDto, { name: '   ' }))).not.toEqual([]);

        const filter = plainToInstance(StockEntryFilterDto, {
            month: '11', year: '2026', productId, supplierId,
        });
        expect(validateSync(filter)).toEqual([]);
        expect(filter.month).toBe(11);
        expect(filter.year).toBe(2026);
        expect(validateSync(plainToInstance(StockEntryFilterDto, { month: '13' }))).not.toEqual([]);
    });
});
