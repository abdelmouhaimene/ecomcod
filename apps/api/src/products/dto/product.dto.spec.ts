import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ProductDto } from './product.dto.js';

const categoryId = '11111111-1111-4111-8111-111111111111';

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ref: 'sku-1',
    name: 'Headphones',
    subtitle: null,
    description: null,
    price: '19.99',
    oldPrice: null,
    fakeReviews: '4.5',
    realReviews: 3.2,
    fakeSolds: 0,
    realSolds: 0,
    categoryIds: [categoryId],
    images: [
      { key: 'main', url: '/uploads/main.png', isMain: true, position: '0' },
      { key: 'side', url: '/uploads/side.png', isMain: false, position: 1 },
    ],
    variants: [{ name: 'Color', value: 'Black', price: '0', imageKey: 'main' }],
    ...overrides,
  };
}

function errors(overrides: Record<string, unknown> = {}): string[] {
  const dto = plainToInstance(ProductDto, payload(overrides));
  return (validateSync(dto) ?? []).flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('ProductDto', () => {
  it('accepts nullable optional fields and coerces numeric strings', () => {
    expect(errors()).toEqual([]);
    const dto = plainToInstance(ProductDto, payload());
    expect(dto.price).toBe(19.99);
    expect(dto.oldPrice).toBeNull();
    expect(dto.fakeReviews).toBe(4.5);
    expect(dto.images[0].position).toBe(0);
  });

  it('rejects whitespace-only strings and negative numbers', () => {
    expect(errors({ name: '   ' }).join(' ')).toContain('name should not be empty');
    expect(errors({ price: -1 }).join(' ')).toContain('price must not be less than 0');
  });

  it('accepts ratings from 0 to 5 with one decimal place', () => {
    expect(errors({ fakeReviews: 0, realReviews: 5 }).join(' ')).toBe('');
    expect(errors({ fakeReviews: 1.5 }).join(' ')).toBe('');
    expect(errors({ realReviews: '3.7' }).join(' ')).toBe('');
    expect(errors({ fakeReviews: 5.1 }).join(' ')).toContain('fakeReviews must not be greater than 5');
    expect(errors({ fakeReviews: -0.1 }).join(' ')).toContain('fakeReviews must not be less than 0');
    expect(errors({ fakeReviews: 4.55 }).join(' ')).toContain('fakeReviews must have at most one decimal place');
  });

  it('requires a category and exactly one main image', () => {
    expect(errors({ categoryIds: [] }).join(' ')).toContain('categoryIds should not be empty');
    const twoMains = payload().images as Array<Record<string, unknown>>;
    twoMains[1].isMain = true;
    expect(errors({ images: twoMains }).join(' ')).toContain('Exactly one image must be marked as main.');
  });

  it('validates variant image keys and duplicate keys', () => {
    expect(errors({
      variants: [{ name: 'Color', value: 'Red', price: 0, imageKey: 'missing' }],
    }).join(' ')).toContain('Each variant imageKey must reference an image in this product.');

    const images = payload().images as Array<Record<string, unknown>>;
    images[1].key = 'main';
    expect(errors({ images }).join(' ')).toContain('Image keys must be unique.');
  });
});
