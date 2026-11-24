import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import type { PaginatedProducts, PublicProduct } from '@repo/types';
import { FindProductsDto } from './dto/find-products.dto.js';
import { ProductsService } from './products.service.js';

/** Read-only catalog for the storefront; all writes stay under /admin/products. */
@Controller({ path: 'products', version: '1' })
export class PublicProductsController {
    constructor(private readonly products: ProductsService) { }

    /** URL query parameters are the single source of truth for filtering/paging. */
    @Get()
    findAll(@Query() query: FindProductsDto): Promise<PaginatedProducts<Date>> {
        return this.products.findPaginated(query);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicProduct<Date>> {
        return this.products.findOne(id);
    }
}
