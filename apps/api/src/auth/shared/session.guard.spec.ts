import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/users.service.js';
import { SessionGuard, type RequestWithUser } from './session.guard.js';
import { SessionService } from './session.service.js';

function contextFor(request: RequestWithUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  let guard: SessionGuard;
  let sessions: {
    getUserId: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  let users: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    sessions = {
      getUserId: vi.fn(async () => null),
      destroy: vi.fn(async () => undefined),
    };
    users = { findById: vi.fn(async () => null) };

    guard = new SessionGuard(
      sessions as unknown as SessionService,
      users as unknown as UsersService,
    );
  });

  it('rejects requests without a session cookie', async () => {
    const request = {} as RequestWithUser;

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.getUserId).toHaveBeenCalledWith(undefined);
  });

  it('rejects unknown or expired sessions', async () => {
    const request = { cookies: { session: 'expired' } } as unknown as RequestWithUser;

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('attaches the user for a valid session', async () => {
    const user = { id: 'u1', isActive: true } as User;
    sessions.getUserId.mockResolvedValueOnce('u1');
    users.findById.mockResolvedValueOnce(user);
    const request = { cookies: { session: 'token-1' } } as unknown as RequestWithUser;

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(users.findById).toHaveBeenCalledWith('u1');
    expect(request.user).toBe(user);
  });

  it('rejects and cleans up sessions for disabled users', async () => {
    sessions.getUserId.mockResolvedValueOnce('u1');
    users.findById.mockResolvedValueOnce({ id: 'u1', isActive: false } as User);
    const request = { cookies: { session: 'token-1' } } as unknown as RequestWithUser;

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.destroy).toHaveBeenCalledWith('token-1');
    expect(request.user).toBeUndefined();
  });

  it('rejects and cleans up sessions for deleted users', async () => {
    sessions.getUserId.mockResolvedValueOnce('u1');
    users.findById.mockResolvedValueOnce(null);
    const request = { cookies: { session: 'token-1' } } as unknown as RequestWithUser;

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.destroy).toHaveBeenCalledWith('token-1');
  });
});
