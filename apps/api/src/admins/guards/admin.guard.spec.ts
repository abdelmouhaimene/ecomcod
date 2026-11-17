import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_SESSION_COOKIE } from '../../auth/shared/session.service.js';
import { AdminRole } from '@repo/types';
import { AdminGuard } from './admin.guard.js';
import type { Admin } from '../entities/admin.entity.js';

function contextWithCookie(cookie?: string) {
  const request: Record<string, unknown> = {
    cookies: cookie ? { [ADMIN_SESSION_COOKIE]: cookie } : {},
  };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class TestController {},
    } as unknown as ExecutionContext,
  };
}

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the guard to reject');
}

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let sessions: { getAdminId: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
  let admins: { findById: ReturnType<typeof vi.fn> };

  const system = { id: 'a1', role: AdminRole.SYSTEM, isActive: true } as Admin;
  const manager = { id: 'a2', role: AdminRole.MANAGER, isActive: true } as Admin;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn(() => undefined) };
    sessions = {
      getAdminId: vi.fn(async () => 'a1'),
      destroy: vi.fn(async () => undefined),
    };
    admins = { findById: vi.fn(async () => system) };
    guard = new AdminGuard(
      reflector as unknown as Reflector,
      sessions as unknown as never,
      admins as unknown as never,
    );
  });

  it('rejects a request without an admin cookie', async () => {
    sessions.getAdminId.mockResolvedValueOnce(null);
    const { context } = contextWithCookie();

    const error = await rejected(guard.canActivate(context));
    expect(error).toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a customer session token', async () => {
    const { context } = contextWithCookie('customer-token');

    sessions.getAdminId.mockResolvedValueOnce(null);
    await expect(rejected(guard.canActivate(context))).resolves.toBeInstanceOf(UnauthorizedException);
    expect(sessions.getAdminId).toHaveBeenCalledWith('customer-token');
  });

  it('attaches the admin to the request', async () => {
    const { context, request } = contextWithCookie('admin-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(admins.findById).toHaveBeenCalledWith('a1');
    expect(request.admin).toBe(system);
  });

  it('forbids a manager on a system-only route', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce([AdminRole.SYSTEM]);
    admins.findById.mockResolvedValueOnce(manager);
    const { context } = contextWithCookie('admin-token');

    const error = await rejected(guard.canActivate(context));
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as Error).message).toBe('Insufficient permissions');
  });

  it('allows a manager on a manager-or-system route', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce([AdminRole.SYSTEM, AdminRole.MANAGER]);
    admins.findById.mockResolvedValueOnce(manager);
    const { context } = contextWithCookie('admin-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('destroys the session of a disabled or missing admin', async () => {
    admins.findById.mockResolvedValueOnce(null);
    const { context } = contextWithCookie('stale-token');

    await expect(rejected(guard.canActivate(context))).resolves.toBeInstanceOf(UnauthorizedException);
    expect(sessions.destroy).toHaveBeenCalledWith('stale-token');
  });
});
