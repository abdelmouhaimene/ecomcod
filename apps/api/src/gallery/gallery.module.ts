import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { GalleryController } from './gallery.controller.js';
import { GalleryService } from './gallery.service.js';
import { PublicGalleryController } from './public-gallery.controller.js';
import { GalleryPhoto } from './entities/gallery-photo.entity.js';
import { GallerySetting } from './entities/gallery-setting.entity.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([GalleryPhoto, GallerySetting, Admin]),
        forwardRef(() => SessionModule),
    ],
    controllers: [GalleryController, PublicGalleryController],
    providers: [GalleryService, AdminsService, AdminGuard],
    exports: [GalleryService],
})
export class GalleryModule { }
