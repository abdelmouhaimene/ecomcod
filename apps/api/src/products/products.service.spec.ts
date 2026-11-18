import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { ProductDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';
import { Product } from './entities/product.entity.js';

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
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
    variants: [{ key: 'var-1', name: 'Color', value: 'Black', price: 0, imageKey: 'img-1' }],
    ...overrides,
  } as ProductDto;
}

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let manager: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  const dates = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
  const product = {
    id: 'product-1',
    ...makeDto(),
    ...dates,
    productCategories: [
      {
        category: {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Audio',
          ref: 'audio',
          ...dates,
        },
      },
    ],
    images: [
      { id: 'image-1', url: '/uploads/main.jpg', isMain: true, position: 0, createdAt: dates.createdAt },
      { id: 'image-2', url: '/uploads/side.jpg', isMain: false, position: 1, createdAt: dates.createdAt },
    ],
    variants: [
      {
        id: 'variant-1',
        name: 'Color',
        value: 'Black',
        price: 0,
        imageId: 'image-1',
        image: { id: 'image-1', url: '/uploads/main.jpg' },
        createdAt: dates.createdAt,
      },
    ],
  } as unknown as Product;

  beforeEach(async () => {
    repo = {
      find: vi.fn(async () => [product]),
      findOne: vi.fn(async () => product),
      findOneBy: vi.fn(async (where: Record<string, string>) =>
        where.id === product.id ? product : null,
      ),
      delete: vi.fn(async () => ({ affected: 1 })),
    };
    manager = {
      count: vi.fn(async () => 1),
      create: vi.fn((_target: unknown, value: unknown) => value),
      save: vi.fn(async (_target: unknown, value: unknown) => value),
      update: vi.fn(async () => ({ affected: 1 })),
      find: vi.fn(async () => []),
      delete: vi.fn(async () => ({ affected: 1 })),
    };
    dataSource = {
      transaction: vi.fn(async (callback: (manager: unknown) => Promise<unknown>) => callback(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repo },
        { provide: getRepositoryToken(Category), useValue: { count: vi.fn() } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('maps the full public product shape', async () => {
    const result = await service.findOne(product.id);

    expect(result).toMatchObject({
      id: product.id,
      categories: [{ ref: 'audio' }],
      images: [
        { key: 'image-1', isMain: true, position: 0 },
        { key: 'image-2', isMain: false, position: 1 },
      ],
      variants: [{ key: 'variant-1', imageKey: 'image-1', imageUrl: '/uploads/main.jpg' }],
    });
    expect(result.subtitle).toBe('  Over ear  ');
  });

  it('rejects payloads without exactly one main image', async () => {
    const none = await rejected(service.create(makeDto({
      images: [{ key: 'img-1', url: '/a.jpg', isMain: false, position: 0 }],
    })));
    expect(none).toBeInstanceOf(BadRequestException);
    expect((none as Error).message).toBe('Exactly one image must be marked as main.');

    const two = await rejected(service.create(makeDto({
      images: [
        { key: 'img-1', url: '/a.jpg', isMain: true, position: 0 },
        { key: 'img-2', url: '/b.jpg', isMain: true, position: 1 },
      ],
    })));
    expect(two).toBeInstanceOf(BadRequestException);
  });

  it('rejects variant imageKeys that are not in the payload', async () => {
    const error = await rejected(service.create(makeDto({
      variants: [{ name: 'Color', value: 'Red', price: 0, imageKey: 'missing' }],
    })));

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toBe(
      'Each variant imageKey must reference an image in this product.',
    );
  });

  it('rejects unknown categories before persisting', async () => {
    manager.count.mockResolvedValueOnce(0);
    const error = await rejected(service.create(makeDto()));

    expect(error).toBeInstanceOf(NotFoundException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('creates a product and all of its children', async () => {
    await expect(service.create(makeDto())).resolves.toMatchObject({ id: product.id });

    const saves = manager.save.mock.calls.map((call) => call[0]?.name ?? call[0]);
    expect(saves).toContain('Product');
    expect(saves).toContain('ProductCategory');
    expect(saves.filter((name: unknown) => name === 'ProductImage')).toHaveLength(2);
    expect(saves).toContain('ProductVariant');
  });

  it('maps a unique ref violation to a conflict', async () => {
    repo.findOneBy.mockResolvedValueOnce({ id: 'another-product' });
    const error = await rejected(service.create(makeDto()));

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe('A product with this ref already exists.');
  });

  it('preserves ids for existing keys and links variants to final image ids', async () => {
    manager.find
      .mockResolvedValueOnce([{ id: 'image-1', createdAt: dates.createdAt }])
      .mockResolvedValueOnce([{ id: 'variant-1', createdAt: dates.createdAt }]);

    const dto = makeDto({
      images: [
        { key: 'image-1', url: '/a.jpg', isMain: true, position: 0 },
        { key: 'temp-image', url: '/b.jpg', isMain: false, position: 1 },
      ],
      variants: [
        { key: 'variant-1', name: 'Color', value: 'Black', price: 0, imageKey: 'temp-image' },
      ],
    });
    await service.update(product.id, dto);

    const savedImages = manager.save.mock.calls
      .filter((call) => call[0]?.name === 'ProductImage')
      .map((call) => call[1] as { id: string; isMain: boolean });
    expect(savedImages[0].id).toBe('image-1');
    expect(savedImages[1].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(savedImages.filter((image) => image.isMain)).toHaveLength(1);

    const savedVariants = manager.save.mock.calls
      .filter((call) => call[0]?.name === 'ProductVariant')
      .map((call) => call[1] as { id: string; imageId: string });
    expect(savedVariants[0].id).toBe('variant-1');
    expect(savedVariants[0].imageId).toBe(savedImages[1].id);
  });

  it('reports a missing product on delete', async () => {
    repo.findOneBy.mockResolvedValueOnce(null);
    await expect(rejected(service.remove('missing'))).resolves.toBeInstanceOf(NotFoundException);
  });

  it('deletes a product', async () => {
    await service.remove(product.id);
    expect(repo.delete).toHaveBeenCalledWith({ id: product.id });
  });
});
