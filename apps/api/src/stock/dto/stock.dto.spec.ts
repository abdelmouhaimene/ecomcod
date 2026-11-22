import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { StockEntryDto, StockEntryFilterDto, SupplierDto } from './stock.dto.js';

const productId = '11111111-1111-4111-8111-111111111111';
const otherProductId = '44444444-4444-4444-8444-444444444444';
const skuId = '33333333-3333-4333-8333-333333333333';
const otherSkuId = '55555555-5555-4555-8555-555555555555';
const supplierId = '22222222-2222-4222-8222-222222222222';

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    productId,
    buyingPrice: '12.50',
    totalQuantity: '3',
    combinations: [{ skuId, quantity: '3' }],
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: '2026-11-18',
    supplierId,
    items: [item()],
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
  return validateSync(dto).flatMap(messages);
}

describe('Stock DTOs', () => {
    it('coerces numbers and accepts a calendar date', () => {
        expect(errors()).toEqual([]);
        const dto = plainToInstance(StockEntryDto, payload());
        expect(dto.date).toBe('2026-11-18');
        expect(dto.items[0].buyingPrice).toBe(12.5);
        expect(dto.items[0].totalQuantity).toBe(3);
        expect(dto.items[0].combinations[0].quantity).toBe(3);
    });

    it('rejects invalid dates, suppliers and empty or duplicate lines', () => {
        expect(errors({ date: '2026-02-30' }).join(' ')).toContain('valid YYYY-MM-DD');
        expect(errors({ date: '18/11/2026' }).join(' ')).toContain('valid YYYY-MM-DD');
        expect(errors({ supplierId: 'nope' }).join(' ')).toContain('supplierId must be a UUID');
        expect(errors({ items: [] }).join(' ')).toContain('items should not be empty');
        expect(errors({ items: [item(), item()] }).join(' '))
            .toContain('A product can appear only once in a stock entry.');
        expect(errors({ items: [item(), item({ productId: otherProductId })] }).join(' '))
            .toContain('A SKU can appear only once in a stock entry.');
        expect(errors({ items: [item({
            combinations: [{ skuId, quantity: 1 }, { skuId, quantity: 2 }],
        })] }).join(' ')).toContain('A combination can appear only once for a product.');
    });

    it('requires a positive integer total and a non-negative two-decimal buying price', () => {
        expect(errors({ items: [item({ buyingPrice: -1 })] }).join(' '))
            .toContain('buyingPrice must not be less than 0');
        expect(errors({ items: [item({ buyingPrice: 1.234 })] }).join(' '))
            .toContain('buyingPrice must have at most two decimal places');
        expect(errors({ items: [item({ buyingPrice: 0 })] })).toEqual([]);
        expect(errors({ items: [item({ totalQuantity: 0 })] }).join(' '))
            .toContain('totalQuantity must not be less than 1');
        expect(errors({ items: [item({ totalQuantity: 1.5 })] }).join(' '))
            .toContain('totalQuantity must be an integer number');
        expect(errors({ items: [item({ combinations: [{ skuId, quantity: -1 }] })] }).join(' '))
            .toContain('quantity must not be less than 0');
    });

    it('allows zero-quantity combinations inside a product line', () => {
        expect(errors({ items: [item({
            totalQuantity: 3,
            combinations: [{ skuId, quantity: 0 }, { skuId: otherSkuId, quantity: 3 }],
        })] })).toEqual([]);
    });

    it('enforces the exact combination sum with explicit messages', () => {
        expect(errors({ items: [item({
            totalQuantity: 5,
            combinations: [{ skuId, quantity: 2 }, { skuId: otherSkuId, quantity: 1 }],
        })] }).join(' ')).toContain('Combination quantities (3) are less than totalQuantity (5).');
        expect(errors({ items: [item({
            totalQuantity: 2,
            combinations: [{ skuId, quantity: 2 }, { skuId: otherSkuId, quantity: 1 }],
        })] }).join(' ')).toContain('Combination quantities (3) are greater than totalQuantity (2).');
    });

    it('validates supplier names and list filters', () => {
        const supplier = plainToInstance(SupplierDto, { name: '  Acme  ' });
        expect(validateSync(supplier)).toEqual([]);
        expect(supplier.name).toBe('Acme');
        expect(validateSync(plainToInstance(SupplierDto, { name: '   ' }))).not.toEqual([]);

        const filter = plainToInstance(StockEntryFilterDto, {
            month: '11', year: '2026', productId, supplierId, skuId,
        });
        expect(validateSync(filter)).toEqual([]);
        expect(filter.month).toBe(11);
        expect(filter.year).toBe(2026);
        expect(filter.skuId).toBe(skuId);
        expect(validateSync(plainToInstance(StockEntryFilterDto, { month: '13' }))).not.toEqual([]);
    });

    it('trims supplier contacts, normalises blanks to null and validates them', () => {
        const supplier = plainToInstance(SupplierDto, {
            name: '  Acme  ',
            address: '  12 Rue de Paris  ',
            phone: '  0102030405  ',
            email: '  buyer@acme.test  ',
            description: '  Preferred partner  ',
        });
        expect(validateSync(supplier)).toEqual([]);
        expect(supplier.address).toBe('12 Rue de Paris');
        expect(supplier.phone).toBe('0102030405');
        expect(supplier.email).toBe('buyer@acme.test');
        expect(supplier.description).toBe('Preferred partner');

        const blank = plainToInstance(SupplierDto, {
            name: 'Acme',
            address: '   ',
            phone: '',
            email: '\t',
            description: ' \n ',
        });
        expect(validateSync(blank)).toEqual([]);
        expect(blank.address).toBeNull();
        expect(blank.phone).toBeNull();
        expect(blank.email).toBeNull();
        expect(blank.description).toBeNull();
        expect(validateSync(plainToInstance(SupplierDto, { name: 'Acme' }))).toEqual([]);
    });

    it('rejects invalid supplier emails and overlong contact values', () => {
        const dto = plainToInstance(SupplierDto, {
            name: 'Acme',
            email: 'not-an-email',
            address: 'a'.repeat(301),
            phone: '1'.repeat(51),
            description: 'd'.repeat(1001),
        });
        const violations = validateSync(dto).flatMap(messages).join(' ');
        expect(violations).toContain('email must be an email');
        expect(violations).toContain('address must be shorter than or equal to 300 characters');
        expect(violations).toContain('phone must be shorter than or equal to 50 characters');
        expect(violations).toContain('description must be shorter than or equal to 1000 characters');
    });
});
