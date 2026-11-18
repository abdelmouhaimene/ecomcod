import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AdminRole, type PublicStockEntry } from '@repo/types';
import { CurrentAdmin } from '../admins/decorators/current-admin.decorator.js';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import type { Admin } from '../admins/entities/admin.entity.js';
import { StockEntryDto, StockEntryFilterDto } from './dto/stock.dto.js';
import {
    StockEntriesService,
    type PublicStockEntryWithDates,
} from './stock-entries.service.js';

/** Any active admin can read entries; creation is manager+, deletion is system-only. */
@Controller({ path: 'admin/stock-entries', version: '1' })
@UseGuards(AdminGuard)
export class StockEntriesController {
    constructor(private readonly entries: StockEntriesService) { }

    @Get()
    findAll(@Query() filter: StockEntryFilterDto): Promise<PublicStockEntryWithDates[]> {
        return this.entries.findAll(filter);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicStockEntry<Date>> {
        return this.entries.findOne(id);
    }

    @Post()
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    create(
        @Body() dto: StockEntryDto,
        @CurrentAdmin() admin: Admin,
    ): Promise<PublicStockEntry<Date>> {
        return this.entries.create(dto, admin.id);
    }

    @Delete(':id')
    @Roles(AdminRole.SYSTEM)
    @HttpCode(204)
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.entries.remove(id);
    }
}
