import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('UsersController', () => {
  let controller: UsersController;

  const rawUser = {
    id: 'user-1',
    email: 'client@example.com',
    fullName: 'Client One',
    phoneNumber: null,
    password: 'hashed-secret',
    googleId: 'google-id',
    isActive: true,
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const publicUser = {
    id: rawUser.id,
    email: rawUser.email,
    fullName: rawUser.fullName,
    phoneNumber: rawUser.phoneNumber,
    isActive: rawUser.isActive,
    emailVerifiedAt: rawUser.emailVerifiedAt,
    createdAt: rawUser.createdAt,
  };
  const usersService = {
    findAll: vi.fn(async () => [rawUser]),
    toPublic: vi.fn(() => publicUser),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns only the public user shape', async () => {
    await expect(controller.findAll()).resolves.toEqual([publicUser]);
    expect(usersService.toPublic).toHaveBeenCalledWith(rawUser);
    expect(JSON.stringify(await controller.findAll())).not.toContain('password');
    expect(JSON.stringify(await controller.findAll())).not.toContain('googleId');
  });
});
