import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { FamiliesController } from './families.controller.js';
import { FamiliesService } from './families.service.js';
import { PublicFamiliesController } from './public-families.controller.js';
import { Family } from './entities/family.entity.js';

@Module({
    imports: [TypeOrmModule.forFeature([Family, Admin]), forwardRef(() => SessionModule)],
    controllers: [FamiliesController, PublicFamiliesController],
    providers: [FamiliesService, AdminsService, AdminGuard],
    exports: [FamiliesService],
})
export class FamiliesModule {}
