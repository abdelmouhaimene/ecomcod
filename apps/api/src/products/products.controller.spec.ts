import { Test, TestingModule } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import { ADMIN_ROLES_KEY } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

describe('ProductsController', () => {
  let controller: ProductsController;
  const product = { id: 'product-1', ref: 'sku-1' };
  const service = {
    findAll: vi.fn(async () => [product]),
    findOne: vi.fn(async () => product),
    create: vi.fn(async () => product),
    update: vi.fn(async () => product),
    remove: vi.fn(async () => undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('delegates every route to the service', async () => {
    await expect(controller.findAll()).resolves.toEqual([product]);
    await expect(controller.findOne(product.id)).resolves.toEqual(product);
    await expect(controller.create({} as never)).resolves.toEqual(product);
    await expect(controller.update(product.id, {} as never)).resolves.toEqual(product);
    await controller.remove(product.id);

    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.update).toHaveBeenCalledWith(product.id, {});
    expect(service.remove).toHaveBeenCalledWith(product.id);
  });

  it('allows any admin to read but only system/manager to write', () => {
    const writers = [controller.create, controller.update, controller.remove];
    for (const handler of writers) {
      expect(Reflect.getMetadata(ADMIN_ROLES_KEY, handler)).toEqual([
        AdminRole.SYSTEM,
        AdminRole.MANAGER,
      ]);
    }
    expect(Reflect.getMetadata(ADMIN_ROLES_KEY, controller.findAll)).toBeUndefined();
    expect(Reflect.getMetadata(ADMIN_ROLES_KEY, controller.findOne)).toBeUndefined();
  });
});
