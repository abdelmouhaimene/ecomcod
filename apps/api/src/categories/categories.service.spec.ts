import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductCategory } from '../products/entities/product-category.entity.js';
import { CategoriesService } from './categories.service.js';
import { Category } from './entities/category.entity.js';

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: {
    find: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let queryBuilder: {
    select: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    getMany: ReturnType<typeof vi.fn>;
  };
  let links: { count: ReturnType<typeof vi.fn> };
  const existing: Category = {
    id: 'category-1',
    name: 'Audio',
    ref: 'audio',
    icon: null,
    productCategories: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(async () => {
    queryBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getMany: vi.fn(async () => []),
    };
    repo = {
      find: vi.fn(async () => [existing]),
      findOneBy: vi.fn(async () => existing),
      create: vi.fn((value: unknown) => value),
      save: vi.fn(async (value: unknown) => value),
      delete: vi.fn(async () => ({ affected: 1 })),
      createQueryBuilder: vi.fn(() => queryBuilder),
    };
    links = { count: vi.fn(async () => 0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: repo },
        { provide: getRepositoryToken(ProductCategory), useValue: links },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('returns only the public category shape', async () => {
    await expect(service.findAll()).resolves.toEqual([
      {
        id: existing.id,
        name: existing.name,
        ref: existing.ref,
        icon: null,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      },
    ]);
    await expect(service.findOne(existing.id)).resolves.toMatchObject({ ref: 'audio' });
  });

  it('reports a missing category', async () => {
    repo.findOneBy.mockResolvedValueOnce(null);
    const error = await rejected(service.findOne('missing'));
    expect(error).toBeInstanceOf(NotFoundException);
  });

  it('creates a trimmed category', async () => {
    const result = await service.create({ name: '  Video ', ref: ' video ' });

    expect(repo.create).toHaveBeenCalledWith({ name: 'Video', ref: 'video', icon: null });
    expect(result.name).toBe('Video');
  });

  it('persists a trimmed icon and exposes it publicly', async () => {
    const result = await service.create({
      name: 'Video',
      ref: 'video',
      icon: '  /uploads/video-icon.png  ',
    });

    expect(repo.create).toHaveBeenCalledWith({
      name: 'Video',
      ref: 'video',
      icon: '/uploads/video-icon.png',
    });
    expect(result.icon).toBe('/uploads/video-icon.png');
  });

  it('clears an icon when the payload is blank or omitted', async () => {
    await service.create({ name: 'Video', ref: 'video', icon: '   ' });
    expect(repo.create).toHaveBeenCalledWith({ name: 'Video', ref: 'video', icon: null });

    const withIcon: Category = { ...existing, icon: '/uploads/audio.png' };
    repo.findOneBy.mockResolvedValueOnce(withIcon);
    await service.update(existing.id, { name: 'Audio', ref: 'audio' });
    expect(withIcon.icon).toBeNull();
  });

  it('rejects duplicate names and refs with distinct messages', async () => {
    queryBuilder.getMany.mockResolvedValueOnce([{ ...existing, name: 'Audio' }]);
    const nameError = await rejected(service.create({ name: ' Audio ', ref: 'new-ref' }));
    expect(nameError).toBeInstanceOf(ConflictException);
    expect((nameError as Error).message).toBe('A category with this name already exists.');

    queryBuilder.getMany.mockResolvedValueOnce([{ ...existing, name: 'Other' }]);
    const refError = await rejected(service.create({ name: 'New', ref: 'audio' }));
    expect((refError as Error).message).toBe('A category with this ref already exists.');
  });

  it('maps a unique-index race to a conflict', async () => {
    repo.save.mockRejectedValueOnce({ code: '23505' });
    const error = await rejected(service.create({ name: 'New', ref: 'new' }));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe('A category with this name or ref already exists.');
  });

  it('updates a category while ignoring its own name and ref', async () => {
    await expect(service.update(existing.id, { name: 'Audio', ref: 'audio' })).resolves.toMatchObject({
      id: existing.id,
    });
    expect(repo.save).toHaveBeenCalledWith(existing);
  });

  it('refuses to delete a category used by products', async () => {
    links.count.mockResolvedValueOnce(2);
    const error = await rejected(service.remove(existing.id));

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe(
      'This category is still used by products and cannot be deleted.',
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes an unused category', async () => {
    await service.remove(existing.id);
    expect(repo.delete).toHaveBeenCalledWith({ id: existing.id });
  });
});
