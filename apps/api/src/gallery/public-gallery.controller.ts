import { Controller, Get } from '@nestjs/common';
import { GalleryService, type GalleryStateWithDates } from './gallery.service.js';

/** Read-only gallery state for the storefront; all writes stay under /admin. */
@Controller({ path: 'gallery', version: '1' })
export class PublicGalleryController {
    constructor(private readonly gallery: GalleryService) { }

    @Get()
    getState(): Promise<GalleryStateWithDates> {
        return this.gallery.getState();
    }
}
