import { Test, TestingModule } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import { ADMIN_ROLES_KEY } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  const category = {
    id: 'category-1',
    name: 'Audio',
    ref: 'audio',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const service = {
    findAll: vi.fn(async () => [category]),
    findOne: vi.fn(async () => category),
    create: vi.fn(async () => category),
    update: vi.fn(async () => category),
    remove: vi.fn(async () => undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: service }],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('delegates every route to the service', async () => {
    await expect(controller.findAll()).resolves.toEqual([category]);
    await expect(controller.findOne(category.id)).resolves.toEqual(category);
    await expect(controller.create({ name: 'Audio', ref: 'audio' })).resolves.toEqual(category);
    await expect(controller.update(category.id, { name: 'Audio', ref: 'audio' })).resolves.toEqual(category);
    await controller.remove(category.id);

    expect(service.findOne).toHaveBeenCalledWith(category.id);
    expect(service.update).toHaveBeenCalledWith(category.id, { name: 'Audio', ref: 'audio' });
    expect(service.remove).toHaveBeenCalledWith(category.id);
  });

  it('restricts writes to system and manager', () => {
    expect(Reflect.getMetadata(ADMIN_ROLES_KEY, controller.create)).toEqual([
      AdminRole.SYSTEM,
      AdminRole.MANAGER,
    ]);
    expect(Reflect.getMetadata(ADMIN_ROLES_KEY, controller.update)).toEqual([
      AdminRole.SYSTEM,
      AdminRole.MANAGER,
    ]);
    expect(Reflect.getMetadata(ADMIN_ROLES_KEY, controller.remove)).toEqual([
      AdminRole.SYSTEM,
      AdminRole.MANAGER,
    ]);
    expect(Reflect.getMetadata(ADMIN_ROLES_KEY, controller.findAll)).toBeUndefined();
  });
});
