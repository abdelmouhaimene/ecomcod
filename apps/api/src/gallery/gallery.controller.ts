import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common';
import {
    AdminRole,
    type PublicGalleryPhoto,
} from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { GalleryPhotoDto, GalleryStatusDto } from './dto/gallery.dto.js';
import { GalleryService, type GalleryStateWithDates } from './gallery.service.js';

/** Any active admin can read gallery state; system/manager may change it. */
@Controller({ path: 'admin/gallery', version: '1' })
@UseGuards(AdminGuard)
export class GalleryController {
    constructor(private readonly gallery: GalleryService) { }

    @Get()
    getState(): Promise<GalleryStateWithDates> {
        return this.gallery.getState();
    }

    @Put('status')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    setActive(@Body() dto: GalleryStatusDto): Promise<GalleryStateWithDates> {
        return this.gallery.setActive(dto.isActive);
    }

    @Post('photos')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    createPhoto(@Body() dto: GalleryPhotoDto): Promise<PublicGalleryPhoto<Date>> {
        return this.gallery.createPhoto(dto);
    }

    @Delete('photos/:id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    @HttpCode(204)
    async removePhoto(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.gallery.removePhoto(id);
    }
}
