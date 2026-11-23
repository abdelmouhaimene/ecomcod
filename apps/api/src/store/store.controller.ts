import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminRole } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { StoreInfoDto } from './dto/store.dto.js';
import { StoreService, type StoreInfoWithDates } from './store.service.js';

/** Any active admin can read store details; system/manager may edit them. */
@Controller({ path: 'admin/store', version: '1' })
@UseGuards(AdminGuard)
export class StoreController {
    constructor(private readonly store: StoreService) { }

    @Get()
    getInfo(): Promise<StoreInfoWithDates> {
        return this.store.getInfo();
    }

    @Put()
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    update(@Body() dto: StoreInfoDto): Promise<StoreInfoWithDates> {
        return this.store.update(dto);
    }
}
