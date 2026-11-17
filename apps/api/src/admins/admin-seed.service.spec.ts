import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminSeedService } from './admin-seed.service.js';
import type { AdminsService } from './admins.service.js';

function configWith(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('AdminSeedService', () => {
  let admins: { seedSystemAdmin: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    admins = { seedSystemAdmin: vi.fn(async () => true) };
  });

  it('seeds admin / admin by default and warns about the default password', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new AdminSeedService(
      admins as unknown as AdminsService,
      configWith({}),
    );

    await service.onApplicationBootstrap();

    expect(admins.seedSystemAdmin).toHaveBeenCalledWith('admin', 'admin');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('default password'));
    warn.mockRestore();
  });

  it('uses configured credentials without warning when they are customized', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const service = new AdminSeedService(
      admins as unknown as AdminsService,
      configWith({ ADMIN_USERNAME: 'root', ADMIN_PASSWORD: 'a-strong-password' }),
    );

    await service.onApplicationBootstrap();

    expect(admins.seedSystemAdmin).toHaveBeenCalledWith('root', 'a-strong-password');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    log.mockRestore();
  });

  it('stays silent when the system admin already exists', async () => {
    admins.seedSystemAdmin.mockResolvedValueOnce(false);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const service = new AdminSeedService(
      admins as unknown as AdminsService,
      configWith({}),
    );

    await service.onApplicationBootstrap();

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
