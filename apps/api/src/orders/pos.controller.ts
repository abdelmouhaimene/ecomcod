import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AdminRole, type PublicOrder } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { OrderDto } from './dto/order.dto.js';
import { OrdersService, type PublicOrderWithDates } from './orders.service.js';

/** Dashboard POS. Writes are restricted to the existing catalog/stock role set. */
@Controller({ path: 'admin/pos', version: '1' })
@UseGuards(AdminGuard)
export class PosController {
    constructor(private readonly orders: OrdersService) { }

    @Get('orders')
    findAll(): Promise<PublicOrderWithDates[]> {
        return this.orders.findAll();
    }

    @Get('orders/:id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicOrder<Date>> {
        return this.orders.findOne(id);
    }

    @Post('orders')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    create(@Body() dto: OrderDto): Promise<PublicOrder<Date>> {
        return this.orders.create({ ...dto, source: 'POS' });
    }
}
