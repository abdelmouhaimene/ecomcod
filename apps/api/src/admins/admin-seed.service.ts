import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminsService } from './admins.service.js';

/**
 * Seeds the single system admin on first boot. Credentials are configurable
 * for real deployments but default to the requested admin / admin.
 */
@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);
  private readonly username: string;
  private readonly password: string;

  constructor(
    private readonly admins: AdminsService,
    config: ConfigService,
  ) {
    this.username = config.get<string>('ADMIN_USERNAME') || 'admin';
    this.password = config.get<string>('ADMIN_PASSWORD') || 'admin';
  }

  async onApplicationBootstrap(): Promise<void> {
    const created = await this.admins.seedSystemAdmin(this.username, this.password);
    if (!created) return;

    this.logger.log(`System admin "${this.username}" created.`);
    if (this.password === 'admin') {
      this.logger.warn(
        'The system admin is using the default password. Set ADMIN_PASSWORD and change it after login.',
      );
    }
  }
}
