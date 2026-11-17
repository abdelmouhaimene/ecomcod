import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminsService } from './admins.service.js';
import { ADMIN_SESSION_COOKIE, SessionService } from '../auth/shared/session.service.js';
import { AdminRole } from '@repo/types';
import type { Admin } from './entities/admin.entity.js';

describe('AdminAuthController', () => {
  let controller: AdminAuthController;
  let admins: {
    verifyLogin: ReturnType<typeof vi.fn>;
    toPublic: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
  };
  let sessions: {
    createForAdmin: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    cookieFor: ReturnType<typeof vi.fn>;
    cookieOptions: Record<string, unknown>;
  };

  beforeEach(async () => {
    const admin = { id: 'a1', username: 'admin', role: AdminRole.SYSTEM } as Admin;
    admins = {
      verifyLogin: vi.fn(async () => admin),
      toPublic: vi.fn((value: Admin) => ({ id: value.id, username: value.username, role: value.role })),
      changePassword: vi.fn(async () => undefined),
    };
    sessions = {
      createForAdmin: vi.fn(async () => ({ token: 'admin-token', maxAge: null })),
      destroy: vi.fn(async () => undefined),
      cookieFor: vi.fn(() => ({ httpOnly: true, path: '/' })),
      cookieOptions: { httpOnly: true, path: '/' },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        { provide: AdminsService, useValue: admins },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();

    controller = module.get<AdminAuthController>(AdminAuthController);
  });

  it('issues the admin cookie with the selected remember setting', async () => {
    const res = { cookie: vi.fn() };

    const result = await controller.login(
      { username: 'admin', password: 'admin', rememberMe: true },
      res as unknown as Response,
    );

    expect(admins.verifyLogin).toHaveBeenCalledWith('admin', 'admin');
    expect(sessions.createForAdmin).toHaveBeenCalledWith('a1', true);
    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      'admin-token',
      { httpOnly: true, path: '/' },
    );
    expect(result).toEqual({
      admin: { id: 'a1', username: 'admin', role: AdminRole.SYSTEM },
    });
  });

  it('defaults to a browser-session cookie', async () => {
    const res = { cookie: vi.fn() };

    await controller.login(
      { username: 'admin', password: 'admin' },
      res as unknown as Response,
    );

    expect(sessions.createForAdmin).toHaveBeenCalledWith('a1', false);
  });

  it('returns the current admin', async () => {
    const admin = { id: 'a1', username: 'admin', role: AdminRole.SYSTEM } as Admin;

    expect(controller.me(admin)).toEqual({
      id: 'a1',
      username: 'admin',
      role: AdminRole.SYSTEM,
    });
  });

  it('changes the password of the current admin', async () => {
    const admin = { id: 'a1' } as Admin;
    const dto = { currentPassword: 'admin', newPassword: 'newsecret456' };

    await expect(controller.changePassword(admin, dto)).resolves.toEqual({
      message: 'Password updated successfully',
    });
    expect(admins.changePassword).toHaveBeenCalledWith('a1', dto);
  });

  it('destroys only the admin session on logout', async () => {
    const req = { cookies: { [ADMIN_SESSION_COOKIE]: 'admin-token', session: 'customer-token' } };
    const res = { clearCookie: vi.fn() };

    await controller.logout(req as unknown as Request, res as unknown as Response);

    expect(sessions.destroy).toHaveBeenCalledWith('admin-token');
    expect(res.clearCookie).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE, {
      httpOnly: true,
      path: '/',
    });
  });
});
