import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PublicStockAvailability } from '@repo/types';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { StockEntriesService } from './stock-entries.service.js';

/** Per-SKU stock snapshot for CMS and POS. Any active admin can read it. */
@Controller({ path: 'admin/stock', version: '1' })
@UseGuards(AdminGuard)
export class StockAvailabilityController {
    constructor(private readonly entries: StockEntriesService) { }

    @Get('availability')
    availability(): Promise<PublicStockAvailability<Date>[]> {
        return this.entries.availability();
    }
}
