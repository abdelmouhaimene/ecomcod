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
import { AdminRole, type PublicSupplier } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SupplierDto } from './dto/stock.dto.js';
import { SuppliersService, type PublicSupplierWithDates } from './suppliers.service.js';

/** Any active admin can read suppliers; only system/manager can change them. */
@Controller({ path: 'admin/suppliers', version: '1' })
@UseGuards(AdminGuard)
export class SuppliersController {
    constructor(private readonly suppliers: SuppliersService) { }

    @Get()
    findAll(): Promise<PublicSupplierWithDates[]> {
        return this.suppliers.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicSupplier<Date>> {
        return this.suppliers.findOne(id);
    }

    @Post()
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    create(@Body() dto: SupplierDto): Promise<PublicSupplier<Date>> {
        return this.suppliers.create(dto);
    }

    @Put(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: SupplierDto,
    ): Promise<PublicSupplier<Date>> {
        return this.suppliers.update(id, dto);
    }

    @Delete(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    @HttpCode(204)
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.suppliers.remove(id);
    }
}
