import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { ProductDto } from './product.dto.js';

const categoryId = '11111111-1111-4111-8111-111111111111';

function colorVariant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: 'color',
    name: 'Color',
    variantType: 'COLOR',
    values: [{ key: 'black', value: 'Black', hexColor: '#000000', imageKey: 'main' }],
    ...overrides,
  };
}

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
    variants: [colorVariant()],
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
  const dto = plainToInstance(ProductDto, payload(overrides));
  return validateSync(dto).flatMap(messages);
}

describe('ProductDto', () => {
  it('accepts nested variants with stable keys and coerces numeric strings', () => {
    expect(errors()).toEqual([]);
    const dto = plainToInstance(ProductDto, payload());
    expect(dto.price).toBe(19.99);
    expect(dto.oldPrice).toBeNull();
    expect(dto.fakeReviews).toBe(4.5);
    expect(dto.images[0].position).toBe(0);
    expect(dto.variants[0]).toMatchObject({
      key: 'color',
      name: 'Color',
      variantType: 'COLOR',
    });
    expect(dto.variants[0].values[0]).toMatchObject({
      key: 'black',
      value: 'Black',
      hexColor: '#000000',
      imageKey: 'main',
    });
    expect(dto.variants[0]).not.toHaveProperty('price');
    expect(dto.variants[0].values[0]).not.toHaveProperty('price');
  });

  it('accepts variant values with no image', () => {
    expect(errors({ variants: [colorVariant({
      values: [{ key: 'black', value: 'Black', hexColor: '#000000' }],
    })] })).toEqual([]);
    expect(errors({ variants: [{
      key: 'size', name: 'Size', variantType: 'SIZE_TEXT',
      values: [{ value: 'M', imageKey: null }],
    }] })).toEqual([]);
  });

  it('rejects prices on variants and values but keeps the product price', () => {
    expect(validateSync(
      plainToInstance(ProductDto, payload()),
      { whitelist: true, forbidNonWhitelisted: true },
    )).toEqual([]);

    const withPrices = payload({
      variants: [colorVariant({
        price: 5,
        values: [{ key: 'black', value: 'Black', hexColor: '#000000', imageKey: 'main', price: 5 }],
      })],
    });
    const messagesWithPrices = validateSync(
      plainToInstance(ProductDto, withPrices),
      { whitelist: true, forbidNonWhitelisted: true },
    ).flatMap(messages);
    expect(messagesWithPrices.filter((text) => text === 'property price should not exist').length)
      .toBeGreaterThanOrEqual(2);
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

  it('accepts every built-in variant type and requires a name for OTHER', () => {
    expect(errors({ variants: [colorVariant({
      variantType: 'DESIGN', name: 'Design', values: [{ value: 'Stripe', imageKey: 'main' }],
    })] })).toEqual([]);
    expect(errors({ variants: [colorVariant({
      variantType: 'SIZE_TEXT', name: 'Size', values: [{ value: 'xxl', imageKey: 'side' }],
    })] })).toEqual([]);
    expect(errors({ variants: [colorVariant({
      variantType: 'SIZE_NUM', name: 'Size', values: [{ value: '42.5', imageKey: 'side' }],
    })] })).toEqual([]);
    expect(errors({ variants: [colorVariant({
      variantType: 'OTHER', name: 'Material', values: [{ value: 'Cotton', imageKey: 'main' }],
    })] })).toEqual([]);
    expect(errors({ variants: [colorVariant({ variantType: 'OTHER', name: '   ' })] }).join(' '))
      .toContain('name should not be empty');
  });

  it('rejects unknown variant types and values invalid for their type', () => {
    expect(errors({ variants: [colorVariant({ variantType: 'WEIGHT' })] }).join(' '))
      .toContain('variantType must be one of the following values: COLOR, SIZE_TEXT, SIZE_NUM, DESIGN, OTHER');
    expect(errors({ variants: [colorVariant({
      values: [{ value: 'Black', imageKey: 'main' }],
    })] }).join(' ')).toContain('Invalid value for this variant type');
    expect(errors({ variants: [colorVariant({
      variantType: 'SIZE_TEXT', name: 'Size', values: [{ value: '42', imageKey: 'side' }],
    })] }).join(' ')).toContain('Invalid value for this variant type');
    expect(errors({ variants: [colorVariant({
      variantType: 'SIZE_NUM', name: 'Size', values: [{ value: 'XL', imageKey: 'side' }],
    })] }).join(' ')).toContain('Invalid value for this variant type');
    expect(errors({ variants: [colorVariant({
      variantType: 'DESIGN', name: 'Design',
      values: [{ value: 'Stripe', hexColor: '#123456', imageKey: 'main' }],
    })] }).join(' ')).toContain('Invalid value for this variant type');
    expect(errors({ variants: [colorVariant({ values: [] })] }).join(' '))
      .toContain('values should not be empty');
  });

  it('validates image references and uniqueness inside nested variants', () => {
    expect(errors({ variants: [colorVariant({
      values: [{ value: 'Red', hexColor: '#ff0000', imageKey: 'missing' }],
    })] }).join(' ')).toContain('Each variant value imageKey must reference an image in this product.');

    expect(errors({ variants: [colorVariant(), colorVariant()] }).join(' '))
      .toContain('Variant keys must be unique when provided.');
    expect(errors({ variants: [colorVariant({ key: 'c1' }), colorVariant({ key: 'c2' })] }).join(' '))
      .toContain('Only one variant is allowed per variant type (or custom name).');
    expect(errors({ variants: [colorVariant({
      values: [
        { key: 'v', value: 'Black', hexColor: '#000000', imageKey: 'main' },
        { key: 'v', value: 'White', hexColor: '#ffffff', imageKey: 'side' },
      ],
    })] }).join(' ')).toContain('Variant value keys must be unique within a variant.');
    expect(errors({ variants: [colorVariant({
      variantType: 'SIZE_TEXT', name: 'Size',
      values: [{ value: 'S', imageKey: 'main' }, { value: 's', imageKey: 'side' }],
    })] }).join(' ')).toContain('Variant values must be unique within a variant.');

    const images = payload().images as Array<Record<string, unknown>>;
    images[1].key = 'main';
    expect(errors({ images }).join(' ')).toContain('Image keys must be unique.');
  });
});
