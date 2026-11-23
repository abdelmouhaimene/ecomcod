import { Controller, Get } from '@nestjs/common';
import { StoreService, type StoreInfoWithDates } from './store.service.js';

/** Read-only store details for the storefront; all writes stay under /admin. */
@Controller({ path: 'store', version: '1' })
export class PublicStoreController {
    constructor(private readonly store: StoreService) { }

    @Get()
    getInfo(): Promise<StoreInfoWithDates> {
        return this.store.getInfo();
    }
}
