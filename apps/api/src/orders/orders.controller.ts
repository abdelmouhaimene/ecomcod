import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { PublicOrder } from '@repo/types';
import { OrderDto } from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

/** Customer checkout. The source is forced so clients cannot create POS orders. */
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
    constructor(private readonly orders: OrdersService) { }

    @Post()
    create(@Body() dto: OrderDto): Promise<PublicOrder<Date>> {
        return this.orders.create({ ...dto, source: 'WEB' });
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicOrder<Date>> {
        return this.orders.findOne(id);
    }
}
