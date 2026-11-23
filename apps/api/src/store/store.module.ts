import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminsService } from '../admins/admins.service.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { StorePhone } from './entities/store-phone.entity.js';
import { StoreSetting } from './entities/store-setting.entity.js';
import { StoreSocialLink } from './entities/store-social-link.entity.js';
import { PublicStoreController } from './public-store.controller.js';
import { StoreController } from './store.controller.js';
import { StoreService } from './store.service.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([StoreSetting, StorePhone, StoreSocialLink, Admin]),
        forwardRef(() => SessionModule),
    ],
    controllers: [StoreController, PublicStoreController],
    providers: [StoreService, AdminsService, AdminGuard],
    exports: [StoreService],
})
export class StoreModule { }
