import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service.js';
import { Category } from '../categories/entities/category.entity.js';
import { Family } from '../families/entities/family.entity.js';
import { ProductDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';
import { Product } from './entities/product.entity.js';

type Variant = ProductDto['variants'][number];
type VariantValue = Variant['values'][number];

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

function colorValue(overrides: Partial<VariantValue> = {}): VariantValue {
  return {
    key: 'value-1',
    value: 'Black',
    hexColor: '#000000',
    imageKey: 'img-1',
    ...overrides,
  };
}

function colorVariant(overrides: Partial<Variant> = {}): Variant {
  return {
    key: 'var-1',
    name: 'Color',
    variantType: 'COLOR',
    values: [colorValue()],
    ...overrides,
  };
}

function makeDto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    ref: 'sku-1',
    name: 'Headphones',
    subtitle: '  Over ear  ',
    description: null,
    price: 99.99,
    oldPrice: null,
    fakeReviews: 4.5,
    realReviews: 3.2,
    fakeSolds: 40,
    realSolds: 5,
    categoryIds: ['11111111-1111-4111-8111-111111111111'],
    images: [
      { key: 'img-1', url: '/uploads/main.jpg', isMain: true, position: 0 },
      { key: 'img-2', url: '/uploads/side.jpg', isMain: false, position: 1 },
    ],
    variants: [colorVariant()],
    ...overrides,
  } as ProductDto;
}

const dates = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const imageRows = [
  { id: 'image-1', url: '/uploads/main.jpg', isMain: true, position: 0, createdAt: dates.createdAt },
  { id: 'image-2', url: '/uploads/side.jpg', isMain: false, position: 1, createdAt: dates.createdAt },
];

const valueRow = {
  id: 'value-1',
  variantId: 'variant-1',
  value: 'Black',
  hexColor: '#000000',
  imageId: 'image-1',
  image: imageRows[0],
  position: 0,
  createdAt: dates.createdAt,
};

const extraValueRow = { ...valueRow, id: 'value-2', value: 'White', position: 1 };

const variantRow = {
  id: 'variant-1',
  name: 'Color',
  variantType: 'COLOR',
  values: [valueRow],
  createdAt: dates.createdAt,
};

const skuRow = {
  id: 'sku-1',
  productId: 'product-1',
  sku: 'PRODUCT-ABC12345',
  combinationKey: 'COLOR:Black',
  label: 'Black',
  imageId: 'image-1',
  image: imageRows[0],
  stockQuantity: 3,
  PMP: 10,
  isActive: true,
  variantValues: [valueRow],
  ...dates,
};

const extraSkuRow = {
  ...skuRow,
  id: 'sku-2',
  sku: 'PRODUCT-DEF67890',
  combinationKey: 'COLOR:White',
  label: 'White',
  variantValues: [extraValueRow],
};

const product = {
  id: 'product-1',
  ...makeDto(),
  ...dates,
  productCategories: [{
    category: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Audio',
      ref: 'audio',
      ...dates,
    },
  }],
  families: [],
  images: imageRows,
  variants: [variantRow],
  skus: [skuRow],
} as unknown as Product;

const skuLinksInsert = 'INSERT INTO "product_sku_variant_values" ("skuId", "variantValueId") VALUES ($1, $2)';

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: Record<string, ReturnType<typeof vi.fn>>;
  let manager: Record<string, ReturnType<typeof vi.fn>>;
  let dataSource: { transaction: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repo = {
      find: vi.fn(async () => [product]),
      findOne: vi.fn(async () => product),
      findOneBy: vi.fn(async (where: Record<string, string>) =>
        where.id === product.id ? product : null,
      ),
      query: vi.fn(async () => [{ count: 0 }]),
      delete: vi.fn(async () => ({ affected: 1 })),
    };
    let idCounter = 0;
    manager = {
      count: vi.fn(async () => 1),
      create: vi.fn((_target: unknown, value: unknown) => value),
      save: vi.fn(async (target: { name?: string }, value: Record<string, unknown>) => ({
        ...value,
        id: value.id ?? `generated-${++idCounter}`,
      })),
      update: vi.fn(async () => ({ affected: 1 })),
      find: vi.fn(async () => []),
      delete: vi.fn(async () => ({ affected: 1 })),
      query: vi.fn(async () => []),
    };
    dataSource = {
      transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repo },
        { provide: getRepositoryToken(Category), useValue: { count: vi.fn(async () => 1) } },
        { provide: getRepositoryToken(Family), useValue: { count: vi.fn(async () => 1) } },
        {
          provide: CacheService,
          useValue: {
            getOrSet: vi.fn(async (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader()),
            invalidate: vi.fn(async () => undefined),
          },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  function saved(targetName: string): Array<Record<string, unknown>> {
    return manager.save.mock.calls
      .filter((call) => call[0]?.name === targetName)
      .map((call) => call[1] as Record<string, unknown>);
  }

  it('maps the full public product shape with nested variants and SKU value links', async () => {
    const result = await service.findOne(product.id);

    expect(result).toMatchObject({
      id: product.id,
      ref: 'sku-1',
      price: 99.99,
      categories: [{ ref: 'audio' }],
      images: [
        { key: 'image-1', isMain: true, position: 0 },
        { key: 'image-2', isMain: false, position: 1 },
      ],
      variants: [{
        id: 'variant-1',
        key: 'variant-1',
        name: 'Color',
        variantType: 'COLOR',
        values: [{
          id: 'value-1',
          key: 'value-1',
          value: 'Black',
          hexColor: '#000000',
          imageKey: 'image-1',
          imageUrl: '/uploads/main.jpg',
        }],
      }],
      skus: [{
        id: 'sku-1',
        sku: 'PRODUCT-ABC12345',
        combinationKey: 'COLOR:Black',
        label: 'Black',
        stockQuantity: 3,
        PMP: 10,
        isActive: true,
        variantValueIds: ['value-1'],
      }],
    });
    expect(result.variants[0]).not.toHaveProperty('price');
    expect(result.variants[0].values[0]).not.toHaveProperty('price');
    expect(result.skus[0]).not.toHaveProperty('price');
    expect(result.subtitle).toBe('  Over ear  ');
  });

  it('rejects payloads without exactly one main image', async () => {
    const none = await rejected(service.create(makeDto({
      images: [{ key: 'img-1', url: '/a.jpg', isMain: false, position: 0 }],
    })));
    expect(none).toBeInstanceOf(BadRequestException);
    expect((none as Error).message).toBe('Exactly one image must be marked as main.');
  });

  it('creates variant values without an image and uses the main image for their SKUs', async () => {
    await expect(service.create(makeDto({
      variants: [colorVariant({ values: [colorValue({ imageKey: null })] })],
    }))).resolves.toMatchObject({ id: product.id });

    expect(saved('ProductVariantValue')[0]).toMatchObject({
      value: 'Black',
      imageId: null,
    });
    expect(saved('ProductSku')[0]).toMatchObject({
      imageId: saved('ProductImage')[0].id,
      isActive: true,
    });
  });

  it('maps image-less variant values to null image keys and empty URLs', async () => {
    const noImageValue = { ...valueRow, imageId: null, image: null };
    repo.findOne.mockResolvedValueOnce({
      ...product,
      variants: [{ ...variantRow, values: [noImageValue] }],
      skus: [{ ...skuRow, variantValues: [noImageValue] }],
    });

    const result = await service.findOne(product.id);

    expect(result.variants[0].values[0]).toMatchObject({
      imageId: null,
      imageKey: null,
      imageUrl: '',
    });
  });

  it('rejects variant values whose imageKey is not in the payload', async () => {
    const error = await rejected(service.create(makeDto({
      variants: [colorVariant({
        values: [colorValue({ value: 'Red', hexColor: '#ff0000', imageKey: 'missing' })],
      })],
    })));

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toBe(
      'Each variant imageKey must reference an image in this product.',
    );
  });

  it('validates variant types and built-in value rules', async () => {
    const cases: Array<[Variant, string]> = [
      [colorVariant({ variantType: 'UNKNOWN' as Variant['variantType'] }), 'Invalid variant type.'],
      [colorVariant({ variantType: 'OTHER', name: '   ' }), 'OTHER variants require a custom type name.'],
      [colorVariant({
        values: [colorValue({ hexColor: undefined })],
      }), 'A COLOR variant requires a valid #RRGGBB hex color.'],
      [colorVariant({
        variantType: 'DESIGN', name: 'Design',
        values: [colorValue({ value: 'Stripe' })],
      }), 'hexColor is only allowed for COLOR variants.'],
      [colorVariant({
        variantType: 'SIZE_TEXT', name: 'Size',
        values: [colorValue({ value: 'XXS', hexColor: undefined })],
      }), 'SIZE_TEXT values must be XS, S, M, L, XL, XXL or XXXL.'],
      [colorVariant({
        variantType: 'SIZE_NUM', name: 'Size',
        values: [colorValue({ value: 'XXL', hexColor: undefined })],
      }), 'SIZE_NUM values must be numeric.'],
    ];

    for (const [variant, expected] of cases) {
      const error = await rejected(service.create(makeDto({ variants: [variant] })));
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toBe(expected);
    }
  });

  it('rejects unknown categories before persisting', async () => {
    manager.count.mockResolvedValueOnce(0);
    const error = await rejected(service.create(makeDto()));
    expect(error).toBeInstanceOf(NotFoundException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('creates a product with variants, values and their generated SKU', async () => {
    await expect(service.create(makeDto())).resolves.toMatchObject({ id: product.id });

    const saves = manager.save.mock.calls.map((call) => call[0]?.name ?? call[0]);
    expect(saves).toContain('Product');
    expect(saves).toContain('ProductCategory');
    expect(saves.filter((name: unknown) => name === 'ProductImage')).toHaveLength(2);
    expect(saves).toContain('ProductVariant');
    expect(saves).toContain('ProductVariantValue');
    expect(saves).toContain('ProductSku');

    expect(saved('ProductVariantValue')[0]).toMatchObject({
      value: 'Black',
      hexColor: '#000000',
      imageId: saved('ProductImage')[0].id,
      position: 0,
    });
    expect(saved('ProductSku')[0]).toMatchObject({
      combinationKey: 'COLOR:Black',
      label: 'Black',
      imageId: saved('ProductImage')[0].id,
      stockQuantity: 0,
      isActive: true,
    });
  });

  it('creates one SKU and two value links for every multi-dimension combination', async () => {
    const dto = makeDto({
      variants: [
        {
          key: 'c1', name: 'Color', variantType: 'COLOR',
          values: [
            { key: 'v-black', value: 'Black', hexColor: '#000000', imageKey: 'img-1' },
            { key: 'v-white', value: 'White', hexColor: '#ffffff', imageKey: 'img-1' },
          ],
        },
        {
          key: 's1', name: 'Size', variantType: 'SIZE_TEXT',
          values: [
            { key: 'v-s', value: 'S', imageKey: 'img-2' },
            { key: 'v-m', value: 'M', imageKey: 'img-2' },
          ],
        },
      ],
    });

    await service.create(dto);

    const savedSkus = saved('ProductSku');
    expect(savedSkus).toHaveLength(4);
    expect(savedSkus.map((sku) => sku.combinationKey)).toEqual(expect.arrayContaining([
      'COLOR:Black|SIZE_TEXT:S',
      'COLOR:Black|SIZE_TEXT:M',
      'COLOR:White|SIZE_TEXT:S',
      'COLOR:White|SIZE_TEXT:M',
    ]));
    expect(savedSkus.every((sku) => String(sku.label).includes(' / '))).toBe(true);
    expect(manager.query.mock.calls.filter((call) => call[0] === skuLinksInsert)).toHaveLength(8);
  });

  it('maps a unique ref violation to a conflict', async () => {
    repo.findOneBy.mockResolvedValueOnce({ id: 'another-product' });
    const error = await rejected(service.create(makeDto()));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe('A product with this ref already exists.');
  });

  it('preserves value ids and stock when a label is renamed and relinks to final image ids', async () => {
    manager.find
      .mockResolvedValueOnce(imageRows)
      .mockResolvedValueOnce([variantRow])
      .mockResolvedValueOnce([valueRow]);

    const dto = makeDto({
      images: [
        { key: 'image-1', url: '/uploads/main.jpg', isMain: true, position: 0 },
        { key: 'temp-image', url: '/uploads/side.jpg', isMain: false, position: 1 },
      ],
      variants: [colorVariant({
        key: 'variant-1',
        values: [colorValue({ key: 'value-1', value: 'Noir', imageKey: 'temp-image' })],
      })],
    });
    await service.update(product.id, dto);

    const savedImages = saved('ProductImage');
    expect(savedImages[0]).toMatchObject({ id: 'image-1', isMain: true });
    expect(savedImages[1].id).not.toBe('image-1');
    expect(savedImages[1].id).not.toBe('temp-image');

    const sideImageId = savedImages[1].id;
    expect(saved('ProductVariant')[0]).toMatchObject({ id: 'variant-1' });
    expect(saved('ProductVariantValue')[0]).toMatchObject({
      id: 'value-1',
      value: 'Noir',
      imageId: sideImageId,
    });
    expect(saved('ProductSku')[0]).toMatchObject({
      id: 'sku-1',
      sku: 'PRODUCT-ABC12345',
      combinationKey: 'COLOR:Noir',
      label: 'Noir',
      stockQuantity: 3,
      PMP: 10,
      isActive: true,
    });
    const inserts = manager.query.mock.calls.filter((call) => call[0] === skuLinksInsert);
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toEqual(['sku-1', 'value-1']);
  });

  it('keeps a combination-key matched SKU active when its value ids change', async () => {
    const legacyValue = { ...valueRow, id: 'legacy-value' };
    const legacySku = {
      ...skuRow,
      variantValues: [legacyValue],
      stockQuantity: 7,
      PMP: 4,
    };
    repo.findOne.mockResolvedValueOnce({ ...product, skus: [legacySku] });
    manager.find
      .mockResolvedValueOnce(imageRows)
      .mockResolvedValueOnce([variantRow])
      .mockResolvedValueOnce([legacyValue]);

    await service.update(product.id, makeDto({
      variants: [colorVariant({
        key: 'variant-1',
        values: [colorValue({ key: 'new-value' })],
      })],
    }));

    const skuSaves = saved('ProductSku');
    expect(skuSaves).toHaveLength(1);
    expect(skuSaves[0]).toMatchObject({
      id: 'sku-1',
      combinationKey: 'COLOR:Black',
      stockQuantity: 7,
      PMP: 4,
      isActive: true,
    });
  });

  it('soft-deactivates SKUs whose combinations were retired', async () => {
    repo.findOne.mockResolvedValueOnce({ ...product, skus: [skuRow, extraSkuRow] });
    manager.find
      .mockResolvedValueOnce(imageRows)
      .mockResolvedValueOnce([variantRow])
      .mockResolvedValueOnce([valueRow, extraValueRow]);

    await service.update(product.id, makeDto({
      variants: [colorVariant({
        key: 'variant-1',
        values: [colorValue({ key: 'value-1' })],
      })],
    }));

    const skuSaves = saved('ProductSku');
    expect(skuSaves).toHaveLength(2);
    expect(skuSaves[0]).toMatchObject({ id: 'sku-1', isActive: true, stockQuantity: 3 });
    expect(skuSaves[1]).toMatchObject({ id: 'sku-2', isActive: false });
  });

  it('blocks deletion of products with stock, order or offer history', async () => {
    repo.query.mockResolvedValueOnce([{ count: 1 }]);
    const error = await rejected(service.remove(product.id));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe(
      'This product has stock, order or offer history and cannot be deleted.',
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('blocks deletion when history references the product but its SKUs are gone', async () => {
    repo.findOne.mockResolvedValueOnce({ ...product, skus: [] });
    repo.query.mockResolvedValueOnce([{ count: 3 }]);
    const error = await rejected(service.remove(product.id));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe(
      'This product has stock, order or offer history and cannot be deleted.',
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes a product', async () => {
    await service.remove(product.id);
    expect(repo.delete).toHaveBeenCalledWith({ id: product.id });
  });
});
