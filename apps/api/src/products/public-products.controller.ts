import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { PublicProduct } from '@repo/types';
import { ProductsService, type PublicProductWithDates } from './products.service.js';

/** Read-only catalog for the storefront; all writes stay under /admin/products. */
@Controller({ path: 'products', version: '1' })
export class PublicProductsController {
    constructor(private readonly products: ProductsService) { }

    @Get()
    findAll(): Promise<PublicProductWithDates[]> {
        return this.products.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicProduct<Date>> {
        return this.products.findOne(id);
    }
}
