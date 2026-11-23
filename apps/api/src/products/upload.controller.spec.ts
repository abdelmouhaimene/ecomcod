import { Test, TestingModule } from '@nestjs/testing';
import { AdminRole } from '@repo/types';
import { ADMIN_ROLES_KEY } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';

describe('UploadController', () => {
  let controller: UploadController;
  const uploads = {
    save: vi.fn(async () => ({ url: '/uploads/image.webp' })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [{ provide: UploadService, useValue: uploads }],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UploadController>(UploadController);
  });

  it('delegates the uploaded file and processing kind to the service', async () => {
    const file = { mimetype: 'image/png' } as Express.Multer.File;
    await expect(controller.upload(file)).resolves.toEqual({ url: '/uploads/image.webp' });
    expect(uploads.save).toHaveBeenCalledWith(file, undefined);

    await controller.upload(file, 'logo');
    expect(uploads.save).toHaveBeenLastCalledWith(file, 'logo');
  });

  it('restricts uploads to system and manager', () => {
    expect(Reflect.getMetadata(ADMIN_ROLES_KEY, UploadController)).toEqual([
      AdminRole.SYSTEM,
      AdminRole.MANAGER,
    ]);
  });
});
