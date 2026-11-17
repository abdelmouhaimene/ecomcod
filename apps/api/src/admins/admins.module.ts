import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './entities/admin.entity.js';
import { AdminsService } from './admins.service.js';
import { AdminSeedService } from './admin-seed.service.js';
import { AdminGuard } from './guards/admin.guard.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminsController } from './admins.controller.js';
import { SessionModule } from '../auth/shared/session.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Admin]), SessionModule],
  controllers: [AdminAuthController, AdminsController],
  providers: [AdminsService, AdminSeedService, AdminGuard],
  exports: [AdminsService],
})
export class AdminsModule {}
